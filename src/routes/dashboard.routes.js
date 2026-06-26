// src/routes/dashboard.routes.js
import { Router } from 'express';
import DashboardController from '../controllers/DashboardController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/system',       authorize('ADMIN'),                      DashboardController.systemMetrics);
router.get('/parent/:id',   authorize('ADMIN', 'STAFF', 'parent'),   DashboardController.parentDashboard);
router.get('/student/:id',  authorize('ADMIN', 'STAFF'),             DashboardController.studentDashboard);

export default router;
