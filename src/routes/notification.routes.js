// src/routes/notification.routes.js
import { Router } from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';
import NotificationController from '../controllers/NotificationController.js';

const router = Router();

// ─── Admin / Staff routes ─────────────────────────────────────────────────────
// POST   /api/v1/notifications/send        → compose & send a notification
// GET    /api/v1/notifications             → list all sent notifications
router.post(
  '/send',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  NotificationController.send
);

router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  NotificationController.list
);

// ─── Parent routes ────────────────────────────────────────────────────────────
// GET    /api/v1/notifications/inbox                 → parent's notification inbox
// GET    /api/v1/notifications/inbox/unread-count    → badge count
// POST   /api/v1/notifications/inbox/:id/read        → mark one as read
// POST   /api/v1/notifications/inbox/mark-all-read   → mark all as read
// POST   /api/v1/notifications/fcm-token             → register device token
// DELETE /api/v1/notifications/fcm-token             → remove token on logout
router.get(
  '/inbox',
  authenticate,
  authorize('parent'),
  NotificationController.inbox
);

router.get(
  '/inbox/unread-count',
  authenticate,
  authorize('parent'),
  NotificationController.unreadCount
);

router.post(
  '/inbox/mark-all-read',
  authenticate,
  authorize('parent'),
  NotificationController.markAllRead
);

router.post(
  '/inbox/:id/read',
  authenticate,
  authorize('parent'),
  NotificationController.markRead
);

router.post(
  '/fcm-token',
  authenticate,
  authorize('parent'),
  NotificationController.registerToken
);

router.delete(
  '/fcm-token',
  authenticate,
  authorize('parent'),
  NotificationController.removeToken
);

export default router;
