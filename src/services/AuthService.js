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

    // Clean expired refresh tokens first
    await cleanExpiredRefreshTokens(userRepository, user._id);

    // Cap active refresh tokens to 10 to prevent performance degradation
    const entity = await userRepository.findByIdWithTokens(user._id);
    if (entity && entity.refreshTokens && entity.refreshTokens.length >= 10) {
      const sortedTokens = [...entity.refreshTokens].sort((a, b) => b.expiresAt - a.expiresAt);
      const keptTokens = sortedTokens.slice(0, 9);
      await userRepository.updateOne(
        { _id: user._id },
        { $set: { refreshTokens: keptTokens } }
      );
    }

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
    const mobileInput = primaryMobileNumber ? primaryMobileNumber.toString().trim() : '';
    const parent = await parentRepository.findOne({
      $or: [
        { primaryMobileNumber: mobileInput },
        { secondaryMobileNumber: mobileInput }
      ]
    });
    if (!parent) throw new AppError('Parent not found', 404);
    if (parent.isPasswordSet) throw new AppError('Onboarding already completed. Please log in normally.', 400);

    let matchedNumber = parent.primaryMobileNumber;
    if (parent.secondaryMobileNumber && parent.secondaryMobileNumber.trim() === mobileInput) {
      matchedNumber = parent.secondaryMobileNumber;
    }

    const lastFour = matchedNumber.slice(-4);
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

    // Clean expired tokens
    await cleanExpiredRefreshTokens(parentRepository, parent._id);

    // Cap active refresh tokens to 10
    const entity = await parentRepository.findByIdWithTokens(parent._id);
    if (entity && entity.refreshTokens && entity.refreshTokens.length >= 10) {
      const sortedTokens = [...entity.refreshTokens].sort((a, b) => b.expiresAt - a.expiresAt);
      const keptTokens = sortedTokens.slice(0, 9);
      await parentRepository.updateOne(
        { _id: parent._id },
        { $set: { refreshTokens: keptTokens } }
      );
    }

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
    if (!refreshToken) throw new AppError('Refresh token is required', 400);

    let targetDomain = domain;
    let targetUserId = userId;
    let tokenEntry = null;

    if (targetUserId && targetDomain) {
      const Repo = targetDomain === 'parent' ? parentRepository : userRepository;
      const entity = await Repo.findByIdWithTokens(targetUserId);
      if (!entity) throw new AppError('Entity not found', 404);

      const activeTokens = (entity.refreshTokens || []).filter(t => t.expiresAt > new Date());
      const compareResults = await Promise.all(
        activeTokens.map(t =>
          bcrypt.compare(refreshToken, t.tokenHash).then(ok => (ok ? t : null))
        )
      );
      tokenEntry = compareResults.find(Boolean);
    } else {
      // Automatic lookup if domain or userId was omitted
      const parents = await mongoose.model('Parent').find({ 'refreshTokens.expiresAt': { $gt: new Date() } }).select('+refreshTokens').lean();
      for (const parent of parents) {
        const activeTokens = (parent.refreshTokens || []).filter(t => t.expiresAt > new Date());
        const compareResults = await Promise.all(
          activeTokens.map(t =>
            bcrypt.compare(refreshToken, t.tokenHash).then(ok => (ok ? t : null))
          )
        );
        const found = compareResults.find(Boolean);
        if (found) {
          targetDomain = 'parent';
          targetUserId = parent._id.toString();
          tokenEntry = found;
          break;
        }
      }

      if (!tokenEntry) {
        const users = await mongoose.model('User').find({ 'refreshTokens.expiresAt': { $gt: new Date() } }).select('+refreshTokens').lean();
        for (const u of users) {
          const activeTokens = (u.refreshTokens || []).filter(t => t.expiresAt > new Date());
          const compareResults = await Promise.all(
            activeTokens.map(t =>
              bcrypt.compare(refreshToken, t.tokenHash).then(ok => (ok ? t : null))
            )
          );
          const found = compareResults.find(Boolean);
          if (found) {
            targetDomain = 'user';
            targetUserId = u._id.toString();
            tokenEntry = found;
            break;
          }
        }
      }
    }

    if (!tokenEntry) throw new AppError('Refresh token invalid', 401);
    if (new Date() > tokenEntry.expiresAt) throw new AppError('Refresh token expired', 401);

    const newPlain = crypto.randomBytes(32).toString('hex');
    const newHash = await bcrypt.hash(newPlain, 10);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const modelName = targetDomain === 'parent' ? 'Parent' : 'User';
      const user = await mongoose.model(modelName).findById(targetUserId).select('+refreshTokens').session(session);
      
      // Filter out expired tokens and the current rotated token
      let filteredTokens = (user.refreshTokens || []).filter(
        t => t.expiresAt > new Date() && t.tokenHash !== tokenEntry.tokenHash
      );

      // Keep only the most recent 10 active tokens to prevent CPU-intensive compare runs
      if (filteredTokens.length >= 10) {
        filteredTokens.sort((a, b) => b.expiresAt - a.expiresAt);
        filteredTokens = filteredTokens.slice(0, 9);
      }

      filteredTokens.push({ tokenHash: newHash, expiresAt: newExpiresAt });
      user.refreshTokens = filteredTokens;
      await user.save({ session });

      const payload = { id: targetUserId, role: user.role || (targetDomain === 'parent' ? 'parent' : 'user') };
      const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

      logger.info(`Refresh token rotated for ${targetUserId} (domain: ${targetDomain})`);
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

    // Filter out expired tokens first to reduce CPU load
    const activeTokens = (entity.refreshTokens || []).filter(t => t.expiresAt > new Date());

    // Async bcrypt compare – avoids blocking the event loop
    const compareResults = await Promise.all(
      activeTokens.map(t =>
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
