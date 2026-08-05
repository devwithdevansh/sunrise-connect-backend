// src/routes/dashboard.routes.js
import { Router } from 'express';
import DashboardController from '../controllers/DashboardController.js';
import authenticate from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/init',         authorize('ADMIN', 'STAFF', 'parent'),   DashboardController.initDashboard);
router.get('/metrics',      authorize('ADMIN', 'STAFF'),             DashboardController.getMetrics);
router.get('/sync-state',   authorize('ADMIN', 'STAFF', 'parent'),   DashboardController.getSyncState);
router.get('/system',       authorize('ADMIN'),                      DashboardController.systemMetrics);
router.get('/parent/:id',   authorize('ADMIN', 'STAFF', 'parent'),   DashboardController.parentDashboard);
router.get('/student/:id',  authorize('ADMIN', 'STAFF'),             DashboardController.studentDashboard);

export default router;
