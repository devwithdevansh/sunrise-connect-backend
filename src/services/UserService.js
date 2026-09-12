// src/services/UserService.js
import bcrypt from 'bcrypt';
import userRepository from '../repositories/userRepository.js';
import AuditService from './AuditService.js';
import AppError from '../utils/AppError.js';
import logger from '../config/logger.js';

class UserService {
  /**
   * Create a new staff/clerk user. Only ADMIN should call this.
   */
  static async createStaff({ name, email, phone, password, role = 'STAFF' }) {
    // Allow creating STAFF and TEACHER accounts through this method
    if (role !== 'STAFF' && role !== 'TEACHER') throw new AppError('Only STAFF and TEACHER accounts can be created through this endpoint', 400);

    // Ensure uniqueness manually across email OR phone if they exist
    if (email) {
      const existingEmail = await userRepository.findOne({ email });
      if (existingEmail) throw new AppError('A user with this email already exists', 409);
    }
    if (phone) {
      const existingPhone = await userRepository.findOne({ contactNo1: phone });
      if (existingPhone) throw new AppError('A user with this phone number already exists', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userRepository.create({ name, email: email || undefined, contactNo1: phone || undefined, passwordHash, role });

    await AuditService.log({
      performedBy: null,
      action: 'STAFF_CREATED',
      details: { userId: user._id, name, email, role }
    });

    logger.info(`Staff user created: ${email}`);
    return { _id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive };
  }

  /**
   * List all staff and teacher users (no password hashes returned).
   */
  static async listStaff() {
    return userRepository.find(
      { role: { $in: ['STAFF', 'TEACHER'] } }, 
      'name email contactNo1 role isActive lastLogin createdAt permissions', 
      { sort: { createdAt: -1 } }
    );
  }

  /**
   * Update a user's teacher profile and permissions
   */
  static async updateTeacherProfile(userId, { role, permissions, teacherProfile }) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    if (role !== undefined && role !== 'STAFF' && role !== 'TEACHER') {
      throw new AppError('Role must be STAFF or TEACHER', 400);
    }

    // Merge new values
    if (role !== undefined) user.role = role;
    if (permissions !== undefined) user.permissions = permissions;
    if (teacherProfile !== undefined) user.teacherProfile = teacherProfile;

    await userRepository.updateOne(
      { _id: userId },
      { $set: { 
        permissions: user.permissions, 
        role: user.role,
        ...(teacherProfile !== undefined && { teacherProfile: user.teacherProfile })
      } }
    );

    await AuditService.log({
      performedBy: null,
      action: 'TEACHER_PROFILE_UPDATED',
      details: { userId, name: user.name }
    });

    return {
      _id: userId,
      role: role !== undefined ? role : user.role,
      permissions: permissions !== undefined ? permissions : user.permissions,
    };
  }

  /**
   * Toggle a staff user's active status (activate/deactivate).
   */
  static async toggleStaffStatus(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (user.role === 'ADMIN') throw new AppError('Cannot deactivate an admin account', 403);

    const newStatus = !user.isActive;
    await userRepository.updateOne({ _id: userId }, { $set: { isActive: newStatus } });

    await AuditService.log({
      performedBy: null,
      action: newStatus ? 'STAFF_ACTIVATED' : 'STAFF_DEACTIVATED',
      details: { userId, name: user.name, email: user.email }
    });

    logger.info(`Staff ${userId} status toggled to ${newStatus}`);
    return { _id: userId, isActive: newStatus };
  }

  /**
   * Reset a staff user's password (admin-only).
   */
  static async resetStaffPassword(userId, newPassword) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (user.role === 'ADMIN') throw new AppError('Cannot reset admin password through this endpoint', 403);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userRepository.updateOne({ _id: userId }, { $set: { passwordHash } });

    await AuditService.log({
      performedBy: null,
      action: 'STAFF_PASSWORD_RESET',
      details: { userId, name: user.name }
    });

    logger.info(`Password reset for staff: ${userId}`);
    return { message: 'Password reset successfully' };
  }

  /**
   * Permanently delete a staff user.
   */
  static async deleteStaff(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (user.role === 'ADMIN') throw new AppError('Cannot delete an admin account', 403);

    await userRepository.deleteOne({ _id: userId });

    try {
      await AuditService.log({
        performedBy: null,
        action: 'STAFF_DELETED',
        details: { userId, name: user.name, email: user.email }
      });
    } catch (err) {
      logger.error(`Failed to write audit log for deleted staff user: ${userId}`);
    }

    logger.info(`Staff user deleted: ${userId}`);
    return { message: 'Staff account deleted successfully' };
  }
}

export default UserService;
