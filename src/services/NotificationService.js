// src/services/NotificationService.js
// Handles composing, sending (via Firebase Admin SDK), and storing notifications.
// Gracefully degrades if Firebase is not configured — logs warning and saves record with FAILED status.

import Notification from '../models/Notification.js';
import parentRepository from '../repositories/parentRepository.js';
import studentRepository from '../repositories/studentRepository.js';
import logger from '../config/logger.js';
import AppError from '../utils/AppError.js';
import { getFirebaseAdmin } from '../config/firebase.js';

class NotificationService {
  /**
   * Register or refresh an FCM token for a parent (called from Flutter on login / token refresh).
   * Deduplicates — won't store the same token twice.
   */
  static async registerFcmToken({ parentId, token, platform = 'android' }) {
    if (!token || typeof token !== 'string' || token.trim() === '') {
      throw new AppError('FCM token is required', 400);
    }

    // Pull existing tokens, remove stale duplicate of this exact token, re-add fresh entry
    await parentRepository.updateOne(
      { _id: parentId },
      { $pull: { fcmTokens: { token } } }
    );
    await parentRepository.updateOne(
      { _id: parentId },
      {
        $push: {
          fcmTokens: {
            $each: [{ token, platform, updatedAt: new Date() }],
            $slice: -10, // keep last 10 tokens per parent (avoids unbounded growth)
          },
        },
      }
    );
    logger.info(`FCM token registered for parent ${parentId}`);
    return { success: true };
  }

  /**
   * Remove an FCM token (called on logout from Flutter).
   */
  static async removeFcmToken({ parentId, token }) {
    await parentRepository.updateOne(
      { _id: parentId },
      { $pull: { fcmTokens: { token } } }
    );
    return { success: true };
  }

  /**
   * Send a BROADCAST notification (manual, from admin).
   *
   * @param {object} opts
   * @param {string} opts.sentBy  - User (admin) ID
   * @param {string} opts.title
   * @param {string} opts.body
   * @param {string} opts.targetType - 'ALL' | 'CLASS' | 'PARENT'
   * @param {object} opts.targetFilter - { standard, medium, parentId } depending on targetType
   */
  static async sendBroadcast({ sentBy, title, body, targetType, targetFilter = {} }) {
    // ── 1. Resolve target parents ─────────────────────────────────────────────
    let parentIds = [];

    if (targetType === 'ALL') {
      // Get all active parents who have at least one FCM token
      const parents = await parentRepository.find({ isActive: true, 'fcmTokens.0': { $exists: true } }, '_id', { limit: 5000 });
      parentIds = parents.map(p => p._id);
    } else if (targetType === 'CLASS') {
      // Filter students by standard + medium → collect unique parentIds
      const { standard, medium } = targetFilter;
      if (!standard || !medium) throw new AppError('standard and medium are required for CLASS targeting', 400);
      const students = await studentRepository.find(
        { standard, medium, isActive: true },
        'parentId',
        { limit: 5000 }
      );
      parentIds = [...new Set(
        students
          .map(s => s.parentId?._id?.toString() || s.parentId?.toString())
          .filter(Boolean)
      )];
    } else if (targetType === 'PARENT') {
      const { parentId } = targetFilter;
      if (!parentId) throw new AppError('parentId is required for PARENT targeting', 400);
      parentIds = [parentId];
    } else {
      throw new AppError('Invalid targetType', 400);
    }

    if (parentIds.length === 0) {
      // Still save the record but mark as NO_TOKENS
      const notification = await Notification.create({
        sentBy,
        title,
        body,
        type: 'BROADCAST',
        targetType,
        targetFilter,
        targetParentIds: [],
        successCount: 0,
        failureCount: 0,
        deliveryStatus: 'NO_TOKENS',
      });
      logger.warn(`Notification sent but no target parents found (targetType: ${targetType})`);
      return notification;
    }

    // ── 2. Collect FCM tokens for all target parents ───────────────────────────
    const targetParents = await parentRepository.find(
      { _id: { $in: parentIds }, 'fcmTokens.0': { $exists: true } },
      'fcmTokens',
      { limit: 5000 }
    );
    const allTokens = targetParents.flatMap(p => (p.fcmTokens || []).map(t => t.token)).filter(Boolean);

    // ── 3. Create the notification record (PENDING) ────────────────────────────
    const notification = await Notification.create({
      sentBy,
      title,
      body,
      type: 'BROADCAST',
      targetType,
      targetFilter,
      targetParentIds: parentIds,
      deliveryStatus: 'PENDING',
    });

    // ── 4. Send via Firebase (fire-and-forget update of status) ───────────────
    const { successCount, failureCount } = await NotificationService._sendViaFcm(allTokens, { title, body, notificationId: notification._id.toString() });

    let deliveryStatus = 'PENDING';
    if (allTokens.length === 0) {
      deliveryStatus = 'NO_TOKENS';
    } else {
      deliveryStatus = failureCount === 0
        ? 'SENT'
        : successCount === 0
          ? 'FAILED'
          : 'PARTIAL_FAIL';
    }

    await Notification.updateOne(
      { _id: notification._id },
      { $set: { successCount, failureCount, deliveryStatus } }
    );

    logger.info(`Broadcast notification sent: ${notification._id} | success: ${successCount} fail: ${failureCount}`);
    return { ...notification.toObject(), successCount, failureCount, deliveryStatus };
  }

  /**
   * Get paginated notification history for admin (all notifications sent).
   */
  static async listNotifications({ page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      Notification.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sentBy', 'name role')
        .lean(),
      Notification.countDocuments({}),
    ]);
    return { notifications, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get notification inbox for a specific parent (what they received).
   */
  static async getParentInbox({ parentId, page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;
    const filter = { targetParentIds: parentId };

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    // Attach isRead per notification for this parent
    const parentIdStr = parentId.toString();
    const withReadStatus = notifications.map(n => ({
      ...n,
      isRead: (n.readBy || []).some(r => r.parentId?.toString() === parentIdStr),
    }));

    return { notifications: withReadStatus, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get unread notification count for a parent (for badge on Flutter dashboard).
   */
  static async getUnreadCount(parentId) {
    const total = await Notification.countDocuments({ targetParentIds: parentId });
    const read = await Notification.countDocuments({ targetParentIds: parentId, 'readBy.parentId': parentId });
    return { unread: total - read };
  }

  /**
   * Mark a notification as read by a parent.
   */
  static async markAsRead({ notificationId, parentId }) {
    const notification = await Notification.findOne({ _id: notificationId, targetParentIds: parentId });
    if (!notification) throw new AppError('Notification not found', 404);

    // Only add read entry if not already there
    const alreadyRead = notification.readBy.some(r => r.parentId?.toString() === parentId.toString());
    if (!alreadyRead) {
      await Notification.updateOne(
        { _id: notificationId },
        { $push: { readBy: { parentId, readAt: new Date() } } }
      );
    }
    return { success: true };
  }

  /**
   * Mark ALL notifications as read for a parent.
   */
  static async markAllAsRead({ parentId }) {
    const unread = await Notification.find({
      targetParentIds: parentId,
      'readBy.parentId': { $ne: parentId },
    }).select('_id');

    if (unread.length > 0) {
      await Notification.updateMany(
        { _id: { $in: unread.map(n => n._id) } },
        { $push: { readBy: { parentId, readAt: new Date() } } }
      );
    }
    return { success: true, marked: unread.length };
  }

  /**
   * Internal: send push notifications via Firebase Admin SDK.
   * Handles token arrays in batches of 500 (FCM multicast limit).
   * Returns { successCount, failureCount }.
   */
  static async _sendViaFcm(tokens, { title, body, data = {} }) {
    if (!tokens || tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      logger.warn('Firebase Admin SDK not initialized — push notifications skipped');
      return { successCount: 0, failureCount: tokens.length };
    }

    const BATCH_SIZE = 500;
    let totalSuccess = 0;
    let totalFailure = 0;

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      try {
        const message = {
          notification: { title, body },
          data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'sunrise_connect_channel',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            },
          },
          tokens: batch,
        };
        const response = await admin.messaging().sendEachForMulticast(message);
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;

        // Clean up invalid tokens from parent records
        const invalidTokens = [];
        response.responses.forEach((r, idx) => {
          if (!r.success) {
            const code = r.error?.code;
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(batch[idx]);
            }
          }
        });
        if (invalidTokens.length > 0) {
          await NotificationService._cleanInvalidTokens(invalidTokens);
        }
      } catch (err) {
        logger.error('FCM batch send error', err);
        totalFailure += batch.length;
      }
    }

    return { successCount: totalSuccess, failureCount: totalFailure };
  }

  /**
   * Remove stale/invalid FCM tokens from all parents.
   */
  static async _cleanInvalidTokens(tokens) {
    try {
      await Promise.all(
        tokens.map(token =>
          parentRepository.updateOne(
            { 'fcmTokens.token': token },
            { $pull: { fcmTokens: { token } } }
          )
        )
      );
      logger.info(`Cleaned ${tokens.length} invalid FCM token(s)`);
    } catch (err) {
      logger.error('Error cleaning invalid FCM tokens', err);
    }
  }
}

export default NotificationService;
