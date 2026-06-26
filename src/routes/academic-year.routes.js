// src/routes/academic-year.routes.js
import express from 'express';
import * as academicYearController from '../controllers/AcademicYearController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = express.Router();

router.use(authenticate);

// GET — any authenticated user can view
router.get('/', academicYearController.getAllAcademicYears);

// POST/PUT/DELETE — ADMIN only
router.post('/', authorize('ADMIN'), academicYearController.createAcademicYear);
router.put('/:id', authorize('ADMIN'), academicYearController.updateAcademicYear);
router.delete('/:id', authorize('ADMIN'), academicYearController.deleteAcademicYear);

export default router;
