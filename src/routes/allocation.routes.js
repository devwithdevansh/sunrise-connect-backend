import express from 'express';
import AllocationController from '../controllers/AllocationController.js';
import protect from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = express.Router();

// Apply protection to all allocation routes
router.use(protect);

// ==========================================
// SUBJECT TEACHER ALLOCATIONS
// ==========================================

// Admins can assign and remove
router.post('/subject-teacher', authorize('ADMIN'), AllocationController.assignSubjectTeacher);
router.delete('/subject-teacher/:id', authorize('ADMIN'), AllocationController.removeSubjectAllocation);

// Admins and Teachers can read
router.get('/subject-teacher', authorize('ADMIN', 'TEACHER'), AllocationController.getSubjectAllocations);


// ==========================================
// CLASS TEACHER ALLOCATIONS
// ==========================================

// Admins can assign and remove
router.post('/class-teacher', authorize('ADMIN'), AllocationController.assignClassTeacher);
router.delete('/class-teacher/:id', authorize('ADMIN'), AllocationController.removeClassTeacherAllocation);

// Admins and Teachers can read
router.get('/class-teacher', authorize('ADMIN', 'TEACHER'), AllocationController.getClassTeacherAllocations);

export default router;
