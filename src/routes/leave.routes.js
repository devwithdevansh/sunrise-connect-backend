import express from 'express';
import LeaveController from '../controllers/LeaveController.js';
import protect from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('ADMIN', 'TEACHER', 'STAFF', 'parent'), LeaveController.createLeaveRequest);
router.get('/', authorize('ADMIN', 'TEACHER', 'STAFF', 'parent'), LeaveController.getLeaveRequests);
router.patch('/:id/status', authorize('ADMIN', 'TEACHER', 'STAFF'), LeaveController.updateLeaveStatus);

export default router;
