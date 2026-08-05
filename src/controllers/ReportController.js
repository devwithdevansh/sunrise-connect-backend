// src/controllers/ReportController.js
import ReportService from '../services/ReportService.js';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/response.js';

class ReportController {
  /** GET /api/v1/reports/unpaid */
  static getUnpaidReport = catchAsync(async (req, res) => {
    // Optional filters: standard, academicYearId, studentIds
    const { standard, academicYearId, studentIds } = req.query;
    const report = await ReportService.getUnpaidReport({ standard, academicYearId, studentIds });
    sendResponse(res, 200, report);
  });

  /** GET /api/v1/reports/collection */
  static getCollectionReport = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query; // YYYY-MM-DD
    const report = await ReportService.getCollectionReport({ startDate, endDate });
    sendResponse(res, 200, report);
  });
}

export default ReportController;
