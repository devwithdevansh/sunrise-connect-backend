import express from 'express';
import ChatController from '../controllers/ChatController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'STAFF', 'TEACHER', 'parent'));

router.post('/conversations', ChatController.createConversation);
router.get('/conversations', ChatController.listConversations);
router.get('/conversations/:id/messages', ChatController.listMessages);
router.post('/conversations/:id/messages', ChatController.sendMessage);
router.post('/conversations/:id/read', ChatController.markRead);

export default router;
