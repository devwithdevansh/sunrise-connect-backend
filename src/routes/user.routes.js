// src/routes/user.routes.js
import { Router } from 'express';
import UserController from '../controllers/UserController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = Router();

// All user management routes require ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN'));

router.post('/', UserController.createStaff);
router.get('/', UserController.listStaff);
router.patch('/:id/toggle-status', UserController.toggleStatus);
router.patch('/:id/reset-password', UserController.resetPassword);
router.delete('/:id', UserController.deleteStaff);

export default router;
