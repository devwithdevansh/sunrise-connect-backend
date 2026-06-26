// src/services/AuthService.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import env from '../config/env.js';
import userRepository from '../repositories/userRepository.js';
import parentRepository from '../repositories/parentRepository.js';
import AuditService from './AuditService.js';
import logger from '../config/logger.js';
import AppError from '../utils/AppError.js';

/** Remove expired refresh tokens from an entity (Parent or User) */
async function cleanExpiredRefreshTokens(repo, entityId) {
  await repo.updateOne(
    { _id: entityId },
    { $pull: { refreshTokens: { expiresAt: { $lt: new Date() } } } }
  );
}

class AuthService {
  /* ----------------------------------------------------------------
   * 1. Portal login – admin / staff (no audit – application event)
   * ---------------------------------------------------------------- */
  static async portalLogin({ email, password }) {
    const user = await userRepository.findByEmailWithPassword(email);
    if (!user) throw new AppError('Invalid credentials', 401);
    if (!user.isActive) throw new AppError('Your account has been deactivated. Contact the administrator.', 403);
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new AppError('Invalid credentials', 401);

    const payload = { id: user._id.toString(), role: user.role };
    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

    const refreshPlain = crypto.randomBytes(32).toString('hex');
    const refreshHash = await bcrypt.hash(refreshPlain, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await userRepository.addRefreshToken(user._id, refreshHash, expiresAt);

    // Update lastLogin timestamp
    await userRepository.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

    logger.info(`Portal login: ${user._id}`);
    return { accessToken, refreshToken: refreshPlain, user: { name: user.name, role: user.role } };
  }

  /* ----------------------------------------------------------------
   * 2. Parent first-login: verify last four digits of mobile number
   * ---------------------------------------------------------------- */
  static async verifyParentLastFour({ primaryMobileNumber, lastFourDigits }) {
    const parent = await parentRepository.findOne({ primaryMobileNumber });
    if (!parent) throw new AppError('Parent not found', 404);
    if (parent.isPasswordSet) throw new AppError('Onboarding already completed. Please log in normally.', 400);
    const lastFour = parent.primaryMobileNumber.slice(-4);
    if (lastFour !== lastFourDigits) throw new AppError('Verification failed', 401);
    return { success: true, parentId: parent._id };
  }

  /* ----------------------------------------------------------------
   * 3. Set parent password (onboarding – write + audit)
   * ---------------------------------------------------------------- */
  static async setParentPassword({ parentId, newPassword }) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const existingParent = await parentRepository.findById(parentId, null, { session });
      if (!existingParent) throw new AppError('Parent not found', 404);
      if (existingParent.isPasswordSet) throw new AppError('Password already set', 400);

      const hash = await bcrypt.hash(newPassword, 12);
      await parentRepository.updateOne(
        { _id: parentId },
        { $set: { passwordHash: hash, isPasswordSet: true } },
        { session }
      );

      await AuditService.log(
        { performedBy: parentId, targetParentId: parentId, action: 'PARENT_PASSWORD_SET', details: {} },
        session
      );
      await session.commitTransaction();
      return { success: true };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /* ----------------------------------------------------------------
   * 4. Parent login (password-based, no audit – application event)
   * ---------------------------------------------------------------- */
  static async parentLogin({ primaryMobileNumber, password }) {
    const parent = await parentRepository.findOneWithPassword({
      $or: [
        { primaryMobileNumber },
        { secondaryMobileNumber: primaryMobileNumber }
      ]
    });
    if (!parent) throw new AppError('Parent not found', 404);
    const match = await bcrypt.compare(password, parent.passwordHash);
    if (!match) throw new AppError('Invalid credentials', 401);

    const payload = { id: parent._id.toString(), role: 'parent' };
    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

    await cleanExpiredRefreshTokens(parentRepository, parent._id);

    const refreshPlain = crypto.randomBytes(32).toString('hex');
    const refreshHash = await bcrypt.hash(refreshPlain, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await parentRepository.updateOne(
        { _id: parent._id },
        { $push: { refreshTokens: { tokenHash: refreshHash, expiresAt } } },
        { session }
      );
      logger.info(`Parent login: ${parent._id}`);
      await session.commitTransaction();
      return { accessToken, refreshToken: refreshPlain };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /* ----------------------------------------------------------------
   * 5. Refresh-token rotation (pull old / push new atomically)
   * ---------------------------------------------------------------- */
  static async rotateRefreshToken({ domain, userId, refreshToken }) {
    const Repo = domain === 'parent' ? parentRepository : userRepository;
    const entity = await Repo.findByIdWithTokens(userId);
    if (!entity) throw new AppError('Entity not found', 404);

    // Async bcrypt compare – avoids blocking the event loop (compareSync takes ~100ms)
    const compareResults = await Promise.all(
      (entity.refreshTokens || []).map(t =>
        bcrypt.compare(refreshToken, t.tokenHash).then(ok => (ok ? t : null))
      )
    );
    const tokenEntry = compareResults.find(Boolean);
    if (!tokenEntry) throw new AppError('Refresh token invalid', 401);
    if (new Date() > tokenEntry.expiresAt) throw new AppError('Refresh token expired', 401);

    const newPlain = crypto.randomBytes(32).toString('hex');
    const newHash = await bcrypt.hash(newPlain, 10);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const modelName = domain === 'parent' ? 'Parent' : 'User';
      const user = await mongoose.model(modelName).findById(userId).select('+refreshTokens').session(session);
      user.refreshTokens = user.refreshTokens.filter(t => t.tokenHash !== tokenEntry.tokenHash);
      user.refreshTokens.push({ tokenHash: newHash, expiresAt: newExpiresAt });
      await user.save({ session });

      const payload = { id: userId, role: entity.role || (domain === 'parent' ? 'parent' : 'user') };
      const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

      logger.info(`Refresh token rotated for ${userId} (domain: ${domain})`);
      await session.commitTransaction();
      return { accessToken, refreshToken: newPlain };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /* ----------------------------------------------------------------
   * 6. Logout – single device
   * ---------------------------------------------------------------- */
  static async logout({ domain, userId, refreshToken }) {
    const Repo = domain === 'parent' ? parentRepository : userRepository;
    const entity = await Repo.findByIdWithTokens(userId);
    if (!entity) return;
    // Async bcrypt compare – avoids blocking the event loop
    const compareResults = await Promise.all(
      (entity.refreshTokens || []).map(t =>
        bcrypt.compare(refreshToken, t.tokenHash).then(ok => (ok ? t : null))
      )
    );
    const tokenEntry = compareResults.find(Boolean);
    if (!tokenEntry) return;
    await Repo.updateOne(
      { _id: userId },
      { $pull: { refreshTokens: { tokenHash: tokenEntry.tokenHash } } }
    );
    logger.info(`Logout: ${userId}`);
  }

  /* ----------------------------------------------------------------
   * 7. Logout all – clear entire array
   * ---------------------------------------------------------------- */
  static async logoutAll({ domain, userId }) {
    const Repo = domain === 'parent' ? parentRepository : userRepository;
    await Repo.updateOne({ _id: userId }, { $set: { refreshTokens: [] } });
    logger.info(`Logout all: ${userId}`);
  }
}

export default AuthService;
