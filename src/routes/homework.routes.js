import express from 'express';
import HomeworkController from '../controllers/HomeworkController.js';
import protect from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('ADMIN', 'TEACHER'), HomeworkController.createHomework);
router.get('/', authorize('ADMIN', 'TEACHER', 'parent'), HomeworkController.getHomework);
router.delete('/:id', authorize('ADMIN', 'TEACHER'), HomeworkController.deleteHomework);

export default router;
