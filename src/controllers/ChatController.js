import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import verifyParentOwnsStudent from '../utils/verifyParentOwnsStudent.js';
import NotificationService from '../services/NotificationService.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import sendResponse from '../utils/response.js';

/** True if the caller may read/write this conversation. */
function canAccess(user, conversation) {
  if (user.role === 'parent') {
    return conversation.parentId.toString() === user.id;
  }
  if (user.role === 'ADMIN') return true; // full oversight
  if (conversation.staffId == null) return user.role === 'STAFF'; // "office" inbox
  return conversation.staffId.toString() === user.id;
}

class ChatController {
  /**
   * POST /api/v1/chat/conversations
   * Parent starts a thread with a specific staffId (e.g. their child's class
   * teacher) or leaves it null to message "the office". Staff/Admin/Teacher
   * can also start one with a parent.
   */
  static createConversation = catchAsync(async (req, res) => {
    const { parentId, staffId, studentId, subject } = req.body;

    let resolvedParentId = parentId;
    let resolvedStaffId = staffId || null;

    if (req.user.role === 'parent') {
      resolvedParentId = req.user.id;
      if (studentId) await verifyParentOwnsStudent(req, studentId);
    } else {
      // A staff/teacher/admin starting a thread is implicitly the assignee,
      // unless an admin explicitly opens it on another staff member's behalf.
      if (!parentId) throw new AppError('parentId is required', 400);
      resolvedStaffId = staffId || req.user.id;
    }

    if (resolvedStaffId) {
      const staffUser = await User.findById(resolvedStaffId).select('role isActive');
      if (!staffUser || !staffUser.isActive) throw new AppError('Staff member not found', 404);
    }

    // Reuse an existing conversation for the same (parent, staff, student)
    // triple instead of spawning duplicates every time someone hits "message".
    const existing = await Conversation.findOne({
      parentId: resolvedParentId,
      staffId: resolvedStaffId,
      studentId: studentId || null,
    });
    if (existing) return sendResponse(res, 200, existing);

    const conversation = await Conversation.create({
      parentId: resolvedParentId,
      staffId: resolvedStaffId,
      studentId: studentId || null,
      subject: subject || (resolvedStaffId ? null : 'School Office'),
    });

    sendResponse(res, 201, conversation, 'Conversation started');
  });

  /**
   * GET /api/v1/chat/conversations
   * Parent: their own threads. Teacher: threads addressed to them by name.
   * Staff: their own threads + every unassigned "office" thread. Admin: all.
   */
  static listConversations = catchAsync(async (req, res) => {
    let query;
    if (req.user.role === 'parent') {
      query = { parentId: req.user.id };
      if (req.query.studentId) query.studentId = req.query.studentId;
    } else if (req.user.role === 'ADMIN') {
      query = {};
    } else if (req.user.role === 'STAFF') {
      query = { $or: [{ staffId: req.user.id }, { staffId: null }] };
    } else {
      // TEACHER — only threads addressed to them specifically; teachers have
      // no shared inbox to keep this scoped to their own students/parents.
      query = { staffId: req.user.id };
    }

    const conversations = await Conversation.find(query)
      .sort({ lastMessageAt: -1 })
      .populate('parentId', 'parentName primaryMobileNumber')
      .populate('staffId', 'name role')
      .populate('studentId', 'studentName');

    sendResponse(res, 200, conversations);
  });

  /**
   * GET /api/v1/chat/conversations/:id/messages?before=&limit=
   */
  static listMessages = catchAsync(async (req, res) => {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) throw new AppError('Conversation not found', 404);
    if (!canAccess(req.user, conversation)) throw new AppError('Not authorized for this conversation', 403);

    const { before, limit = 30 } = req.query;
    const query = { conversationId: conversation._id };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 30, 100));

    sendResponse(res, 200, messages.reverse());
  });

  /**
   * POST /api/v1/chat/conversations/:id/messages
   */
  static sendMessage = catchAsync(async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) throw new AppError('Message text is required', 400);

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) throw new AppError('Conversation not found', 404);
    if (!canAccess(req.user, conversation)) throw new AppError('Not authorized for this conversation', 403);

    const senderRole = req.user.role === 'parent' ? 'parent' : 'staff';
    const message = await Message.create({
      conversationId: conversation._id,
      senderRole,
      senderId: req.user.id,
      text: text.trim(),
    });

    // If a staff member (not the specific assignee) replies to an "office"
    // thread, claim it for them so it moves out of the shared inbox.
    const claimStaffId = senderRole === 'staff' && !conversation.staffId ? req.user.id : conversation.staffId;

    const preview = text.trim().slice(0, 140);
    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessageAt: new Date(),
          lastMessagePreview: preview,
          lastSenderRole: senderRole,
          staffId: claimStaffId,
        },
        $inc: senderRole === 'parent' ? { unreadCountStaff: 1 } : { unreadCountParent: 1 },
      }
    );

    // Best-effort push to the other participant — never block the send on this.
    try {
      if (senderRole === 'parent' && conversation.staffId) {
        await NotificationService.notifyUser({
          recipientRole: 'staff',
          recipientId: conversation.staffId,
          title: 'New message',
          body: preview,
          data: { type: 'NEW_MESSAGE', conversationId: conversation._id.toString() },
        });
      } else if (senderRole === 'staff') {
        await NotificationService.notifyUser({
          recipientRole: 'parent',
          recipientId: conversation.parentId,
          title: conversation.subject || 'New message from school',
          body: preview,
          data: { type: 'NEW_MESSAGE', conversationId: conversation._id.toString() },
        });
      }
    } catch (err) {
      // Push failures should never fail the send — the message is already saved.
    }

    sendResponse(res, 201, message);
  });

  /**
   * POST /api/v1/chat/conversations/:id/read
   * Resets the caller's own unread counter and stamps unread messages
   * from the other side as read.
   */
  static markRead = catchAsync(async (req, res) => {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) throw new AppError('Conversation not found', 404);
    if (!canAccess(req.user, conversation)) throw new AppError('Not authorized for this conversation', 403);

    const myRole = req.user.role === 'parent' ? 'parent' : 'staff';
    const otherRole = myRole === 'parent' ? 'staff' : 'parent';

    await Message.updateMany(
      { conversationId: conversation._id, senderRole: otherRole, readAt: null },
      { $set: { readAt: new Date() } }
    );
    await Conversation.updateOne(
      { _id: conversation._id },
      { $set: myRole === 'parent' ? { unreadCountParent: 0 } : { unreadCountStaff: 0 } }
    );

    sendResponse(res, 200, null, 'Marked as read');
  });
}

export default ChatController;
