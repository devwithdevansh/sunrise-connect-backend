import express from 'express';
import AttendanceController from '../controllers/AttendanceController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = express.Router();

router.use(authenticate);

// A parent's view of their own child's attendance for a given month
router.get('/student/:studentId', authorize('ADMIN', 'STAFF', 'TEACHER', 'parent'), AttendanceController.getAttendanceForStudent);

// Admin: per-class "is attendance filled" cards, teacher reminders, and sheet confirmation
router.get('/overview', authorize('ADMIN', 'STAFF'), AttendanceController.getOverview);
router.post('/remind', authorize('ADMIN', 'STAFF'), AttendanceController.remindTeacher);
router.post('/:id/confirm', authorize('ADMIN', 'STAFF'), AttendanceController.confirmSheet);

// Legacy per-absence verification queue: absences awaiting sign-off before the parent is notified
router.get('/pending-absences', authorize('ADMIN', 'STAFF'), AttendanceController.getPendingAbsences);
router.post('/:id/verify-absence', authorize('ADMIN', 'STAFF'), AttendanceController.verifyAbsence);

router.route('/')
  .get(authorize('ADMIN', 'STAFF', 'TEACHER'), AttendanceController.getAttendance)
  .post(authorize('ADMIN', 'STAFF', 'TEACHER'), AttendanceController.saveAttendance);

export default router;
