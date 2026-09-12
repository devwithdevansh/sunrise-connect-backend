import express from 'express';
import ExamController from '../controllers/ExamController.js';
import protect from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = express.Router();

router.use(protect);

// Exam master data (creation usually by ADMIN, viewing by ADMIN & TEACHER)
router.post('/', authorize('ADMIN', 'TEACHER'), ExamController.createExam);
router.get('/', authorize('ADMIN', 'TEACHER'), ExamController.getExams);

// A parent's view of their own child's results across every exam
router.get('/results/student/:studentId', authorize('ADMIN', 'TEACHER', 'STAFF', 'parent'), ExamController.getResultsForStudent);

// Exam results (class/subject entry & review — staff-side)
router.get('/:examId/results', authorize('ADMIN', 'TEACHER'), ExamController.getExamResults);
router.post('/:examId/results', authorize('ADMIN', 'TEACHER'), ExamController.saveExamResults);

export default router;
