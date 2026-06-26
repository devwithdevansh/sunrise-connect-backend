// src/controllers/DashboardController.js
import DashboardService from '../services/DashboardService.js';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/response.js';

class DashboardController {
  /** GET /api/v1/dashboard/system */
  static systemMetrics = catchAsync(async (req, res) => {
    const data = await DashboardService.getSystemMetrics();
    sendResponse(res, 200, data);
  });

  /** GET /api/v1/dashboard/parent/:id */
  static parentDashboard = catchAsync(async (req, res) => {
    const data = await DashboardService.getParentDashboard(req.params.id);
    sendResponse(res, 200, data);
  });

  /** GET /api/v1/dashboard/student/:id */
  static studentDashboard = catchAsync(async (req, res) => {
    const data = await DashboardService.getStudentDashboard(req.params.id);
    sendResponse(res, 200, data);
  });

  /** GET /api/v1/dashboard/sync-state */
  static getSyncState = catchAsync(async (req, res) => {
    const mongoose = await import('mongoose');
    const AuditLog = mongoose.default.model('AuditLog');
    const latestLog = await AuditLog.findOne().sort({ createdAt: -1 }).select('createdAt');
    const timestamp = latestLog ? latestLog.createdAt.getTime() : 0;
    sendResponse(res, 200, { timestamp });
  });
}

export default DashboardController;
