// src/controllers/ParentController.js
import ParentService from '../services/ParentService.js';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/response.js';

class ParentController {
  /** POST /api/v1/parents */
  static createParent = catchAsync(async (req, res) => {
    const parent = await ParentService.createParent(req.body);
    sendResponse(res, 201, parent);
  });

  /** GET /api/v1/parents/check-mobile */
  static checkMobile = catchAsync(async (req, res) => {
    const parent = await ParentService.checkMobile(req.query);
    sendResponse(res, 200, parent);
  });

  /** GET /api/v1/parents */
  static listParents = catchAsync(async (req, res) => {
    const { limit = 20, skip = 0, ...filter } = req.query;
    const parents = await ParentService.listParents(filter, { limit: Number(limit), skip: Number(skip) });
    sendResponse(res, 200, parents);
  });

  /** GET /api/v1/parents/:id */
  static getParent = catchAsync(async (req, res) => {
    const parent = await ParentService.getParent(req.params.id);
    sendResponse(res, 200, parent);
  });

  /** PATCH /api/v1/parents/:id */
  static updateParent = catchAsync(async (req, res) => {
    const parent = await ParentService.updateParent(req.params.id, req.body);
    sendResponse(res, 200, parent);
  });

  /** POST /api/v1/parents/reset-password (ADMIN only) */
  static resetParentPassword = catchAsync(async (req, res) => {
    await ParentService.resetParentPassword({ ...req.body, performedBy: req.user.id });
    sendResponse(res, 200, null, 'Password reset. Parent must re-onboard.');
  });
}

export default ParentController;
