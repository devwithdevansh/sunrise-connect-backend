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
}

export default DashboardController;
