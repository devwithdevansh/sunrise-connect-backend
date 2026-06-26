// src/routes/audit.routes.js
import { Router } from 'express';
import AuditController from '../controllers/AuditController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/',    AuditController.search);
router.get('/:id', AuditController.findById);

export default router;
