import { Router } from 'express';
import AcademicMasterController from '../controllers/AcademicMasterController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = Router();

// ERP Routes -> Need authentication
router.use(authenticate);
router.use(authorize('ADMIN', 'TEACHER')); // Teachers might need to view subjects/curriculums

// Subjects
router.post('/subjects', authorize('ADMIN'), AcademicMasterController.createSubject);
router.get('/subjects', AcademicMasterController.getSubjects);
router.put('/subjects/:id', authorize('ADMIN'), AcademicMasterController.updateSubject);
router.delete('/subjects/:id', authorize('ADMIN'), AcademicMasterController.deleteSubject);

// Curriculum
router.post('/curriculum', authorize('ADMIN'), AcademicMasterController.createOrUpdateCurriculum);
router.get('/curriculum', AcademicMasterController.getCurriculums);

export default router;
