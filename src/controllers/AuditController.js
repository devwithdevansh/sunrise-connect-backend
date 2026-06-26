// src/controllers/AuditController.js
import AuditService from '../services/AuditService.js';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/response.js';

class AuditController {
  /** GET /api/v1/audit */
  static search = catchAsync(async (req, res) => {
    const { limit = 20, skip = 0, ...filter } = req.query;
    const logs = await AuditService.search(filter, { limit: Number(limit), skip: Number(skip) });
    sendResponse(res, 200, logs);
  });

  /** GET /api/v1/audit/:id */
  static findById = catchAsync(async (req, res) => {
    const log = await AuditService.findById(req.params.id);
    sendResponse(res, 200, log);
  });
}

export default AuditController;
