// src/routes/report.routes.js
import { Router } from 'express';
import ReportController from '../controllers/ReportController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = Router();

router.use(authenticate);

// Reports are typically for ADMIN and STAFF only
router.get('/unpaid', authorize('ADMIN', 'STAFF'), ReportController.getUnpaidReport);
router.get('/collection', authorize('ADMIN', 'STAFF'), ReportController.getCollectionReport);

export default router;
