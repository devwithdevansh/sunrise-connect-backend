import mongoose from 'mongoose';

/**
 * A chat thread between one parent and either a specific staff member
 * (usually a class/subject teacher) or "the office" (staffId null — any
 * ADMIN/STAFF can pick it up; a TEACHER only sees threads addressed to them
 * specifically, since teachers have no shared inbox).
 */
const conversationSchema = new mongoose.Schema(
  {
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parent',
      required: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = directed to "the office" (Admin/Staff inbox)
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null, // optional context, e.g. "about this child"
    },
    subject: {
      type: String,
      trim: true,
      default: null, // e.g. "Class Teacher", "School Office"
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    lastMessagePreview: {
      type: String,
      default: '',
    },
    lastSenderRole: {
      type: String,
      enum: ['parent', 'staff'],
      default: null,
    },
    unreadCountParent: {
      type: Number,
      default: 0,
    },
    unreadCountStaff: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ parentId: 1, lastMessageAt: -1 });
conversationSchema.index({ staffId: 1, lastMessageAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
