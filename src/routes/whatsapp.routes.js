// src/routes/whatsapp.routes.js
import { Router } from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';
import WhatsappController from '../controllers/WhatsappController.js';

const router = Router();

// ─── Admin / Staff routes ─────────────────────────────────────────────────────
// POST   /api/v1/whatsapp/send        → compose & send a whatsapp message
// GET    /api/v1/whatsapp             → list all sent whatsapp messages
router.post(
  '/send',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  WhatsappController.send
);

router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  WhatsappController.list
);

export default router;
