// src/controllers/NotificationController.js
import NotificationService from '../services/NotificationService.js';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/response.js';

class NotificationController {
  /**
   * POST /api/v1/notifications/send
   * Admin/Staff — send a broadcast notification
   */
  static send = catchAsync(async (req, res) => {
    const { title, body, targetType, targetFilter, metadata } = req.body;
    const sentBy = req.user.id;

    const result = await NotificationService.sendBroadcast({
      sentBy,
      title,
      body,
      targetType: targetType || 'ALL',
      targetFilter: targetFilter || {},
      metadata: metadata || {},
    });

    sendResponse(res, 201, result, 'Notification sent successfully');
  });

  /**
   * GET /api/v1/notifications
   * Admin — list all sent notifications (paginated)
   */
  static list = catchAsync(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await NotificationService.listNotifications({ page, limit });
    sendResponse(res, 200, result);
  });

  /**
   * DELETE /api/v1/notifications/:id
   * Admin — delete a notification from history
   */
  static deleteNotification = catchAsync(async (req, res) => {
    await NotificationService.deleteNotification(req.user.id, req.params.id);
    sendResponse(res, 200, null, 'Notification history deleted successfully');
  });

  /**
   * GET /api/v1/notifications/inbox
   * Parent — get their notification inbox
   */
  static inbox = catchAsync(async (req, res) => {
    const parentId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 30;
    const result = await NotificationService.getParentInbox({ parentId, page, limit });
    sendResponse(res, 200, result);
  });

  /**
   * GET /api/v1/notifications/inbox/unread-count
   * Parent — get unread notification count for badge
   */
  static unreadCount = catchAsync(async (req, res) => {
    const parentId = req.user.id;
    const result = await NotificationService.getUnreadCount(parentId);
    sendResponse(res, 200, result);
  });

  /**
   * POST /api/v1/notifications/inbox/:id/read
   * Parent — mark a specific notification as read
   */
  static markRead = catchAsync(async (req, res) => {
    const parentId = req.user.id;
    const notificationId = req.params.id;
    const { studentId } = req.body;
    const result = await NotificationService.markAsRead({ notificationId, parentId, studentId });
    sendResponse(res, 200, result, 'Marked as read');
  });

  /**
   * POST /api/v1/notifications/inbox/mark-all-read
   * Parent — mark all notifications as read
   */
  static markAllRead = catchAsync(async (req, res) => {
    const parentId = req.user.id;
    const { studentId } = req.body;
    const result = await NotificationService.markAllAsRead({ parentId, studentId });
    sendResponse(res, 200, result, `${result.marked} notification(s) marked as read`);
  });

  /**
   * POST /api/v1/notifications/fcm-token
   * Parent — register/refresh their FCM device token
   */
  static registerToken = catchAsync(async (req, res) => {
    const parentId = req.user.id;
    const { token, platform } = req.body;
    const result = await NotificationService.registerFcmToken({ parentId, token, platform });
    sendResponse(res, 200, result, 'FCM token registered');
  });

  /**
   * DELETE /api/v1/notifications/fcm-token
   * Parent — remove FCM token on logout
   */
  static removeToken = catchAsync(async (req, res) => {
    const parentId = req.user.id;
    const { token } = req.body;
    const result = await NotificationService.removeFcmToken({ parentId, token });
    sendResponse(res, 200, result, 'FCM token removed');
  });
}

export default NotificationController;
