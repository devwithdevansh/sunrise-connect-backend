// src/controllers/UserController.js
import UserService from '../services/UserService.js';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/response.js';
import AppError from '../utils/AppError.js';

class UserController {
  /** POST /api/v1/users — Create a new staff/clerk account */
  static createStaff = catchAsync(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) throw new AppError('Name, email, and password are required', 400);
    if (password.length < 6) throw new AppError('Password must be at least 6 characters', 400);

    const user = await UserService.createStaff({ name, email, password });
    sendResponse(res, 201, user, 'Staff account created successfully');
  });

  /** GET /api/v1/users — List all staff accounts */
  static listStaff = catchAsync(async (req, res) => {
    const staff = await UserService.listStaff();
    sendResponse(res, 200, staff);
  });

  /** PATCH /api/v1/users/:id/toggle-status — Activate/deactivate a staff account */
  static toggleStatus = catchAsync(async (req, res) => {
    const result = await UserService.toggleStaffStatus(req.params.id);
    sendResponse(res, 200, result, `Staff account ${result.isActive ? 'activated' : 'deactivated'}`);
  });

  /** PATCH /api/v1/users/:id/reset-password — Reset a staff account's password */
  static resetPassword = catchAsync(async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) throw new AppError('New password must be at least 6 characters', 400);
    const result = await UserService.resetStaffPassword(req.params.id, newPassword);
    sendResponse(res, 200, result);
  });

  /** DELETE /api/v1/users/:id — Permanently delete a staff account */
  static deleteStaff = catchAsync(async (req, res) => {
    const result = await UserService.deleteStaff(req.params.id);
    sendResponse(res, 200, result, 'Staff account deleted successfully');
  });
}

export default UserController;
