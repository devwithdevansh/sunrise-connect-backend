// src/controllers/AuthController.js
import AuthService from '../services/AuthService.js';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/response.js';

class AuthController {
  /** POST /api/v1/auth/portal/login */
  static portalLogin = catchAsync(async (req, res) => {
    const result = await AuthService.portalLogin(req.body);
    sendResponse(res, 200, result);
  });

  /** POST /api/v1/auth/parent/verify */
  static verifyParentLastFour = catchAsync(async (req, res) => {
    const result = await AuthService.verifyParentLastFour(req.body);
    sendResponse(res, 200, result);
  });

  /** POST /api/v1/auth/parent/set-password */
  static setParentPassword = catchAsync(async (req, res) => {
    const result = await AuthService.setParentPassword(req.body);
    sendResponse(res, 200, result);
  });

  /** POST /api/v1/auth/parent/login */
  static parentLogin = catchAsync(async (req, res) => {
    const result = await AuthService.parentLogin(req.body);
    sendResponse(res, 200, result);
  });

  /** POST /api/v1/auth/refresh */
  static refreshToken = catchAsync(async (req, res) => {
    const result = await AuthService.rotateRefreshToken(req.body);
    sendResponse(res, 200, result);
  });

  /** POST /api/v1/auth/logout */
  static logout = catchAsync(async (req, res) => {
    await AuthService.logout({ ...req.body, userId: req.user.id, domain: req.user.role === 'parent' ? 'parent' : 'user' });
    sendResponse(res, 200, null, 'Logged out successfully');
  });

  /** POST /api/v1/auth/logout-all */
  static logoutAll = catchAsync(async (req, res) => {
    await AuthService.logoutAll({ userId: req.user.id, domain: req.user.role === 'parent' ? 'parent' : 'user' });
    sendResponse(res, 200, null, 'All sessions cleared');
  });
}

export default AuthController;
