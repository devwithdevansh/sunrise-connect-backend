// src/services/ParentService.js
// Service layer for Parent entity – frozen architecture compliance
// No OTP, admin‑only password reset, audit on business‑state changes only

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import parentRepository from '../repositories/parentRepository.js';
import AuditService from './AuditService.js';
import logger from '../config/logger.js';
import AppError from '../utils/AppError.js';

class ParentService {
  /** Create a new parent (no password) */
  static async createParent(data) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const parent = await parentRepository.create(data, { session });
      await AuditService.log(
        { performedBy: null, targetParentId: parent._id, action: 'PARENT_CREATED', details: {} },
        session
      );
      await session.commitTransaction();
      return parent;
    } catch (err) {
      await session.abortTransaction();
      logger.error('ParentService.createParent error', err);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /** Update mutable fields of a parent */
  static async updateParent(parentId, updates) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await parentRepository.updateOne({ _id: parentId }, { $set: updates }, { session });
      await AuditService.log(
        { performedBy: null, targetParentId: parentId, action: 'PARENT_UPDATED', details: updates },
        session
      );
      await session.commitTransaction();
      return parentRepository.findById(parentId);
    } catch (e) {
      await session.abortTransaction();
      logger.error('ParentService.updateParent error', e);
      throw e;
    } finally {
      session.endSession();
    }
  }

  /** Retrieve a parent – read‑only, no transaction */
  static async getParent(parentId) {
    const parent = await parentRepository.findById(parentId);
    if (!parent) throw new AppError('Parent not found', 404);
    return parent;
  }

  /** List parents with optional filters */
  static async listParents(filter = {}, pagination = { limit: 20, skip: 0 }) {
    return parentRepository.find(filter, null, pagination);
  }

  /** Check if any parent exists with the given primary or secondary mobile number */
  static async checkMobile(query) {
    const numbersToCheck = [];
    if (query.primaryMobile) {
      let mobile = query.primaryMobile.replace(/\D/g, '');
      if (mobile.length > 10) mobile = mobile.slice(-10);
      if (!/^[6-9]\d{9}$/.test(mobile)) mobile = '9' + mobile.padEnd(9, '0').slice(0, 9);
      numbersToCheck.push(mobile);
    }
    if (query.secondaryMobile) {
      let mobile = query.secondaryMobile.replace(/\D/g, '');
      if (mobile.length > 10) mobile = mobile.slice(-10);
      if (!/^[6-9]\d{9}$/.test(mobile)) mobile = '9' + mobile.padEnd(9, '0').slice(0, 9);
      numbersToCheck.push(mobile);
    }

    if (numbersToCheck.length === 0) return { exists: false, parent: null };

    const parent = await parentRepository.findOne({
      $or: [
        { primaryMobileNumber: { $in: numbersToCheck } },
        { secondaryMobileNumber: { $in: numbersToCheck } }
      ]
    });

    return { exists: !!parent, parent };
  }

  /**
   * Admin‑only password reset.
   * Verifies last 4 digits of primaryMobileNumber in service layer (no DB field).
   * Clears passwordHash and resets isPasswordSet so parent must re-onboard.
   */
  static async resetParentPassword({ primaryMobileNumber, lastFourDigits, performedBy = null }) {
    const mobileInput = primaryMobileNumber ? primaryMobileNumber.toString().trim() : '';
    const parent = await parentRepository.findOne({
      $or: [
        { primaryMobileNumber: mobileInput },
        { secondaryMobileNumber: mobileInput }
      ]
    });
    if (!parent) throw new AppError('Parent not found', 404);

    let matchedNumber = parent.primaryMobileNumber;
    if (parent.secondaryMobileNumber && parent.secondaryMobileNumber.trim() === mobileInput) {
      matchedNumber = parent.secondaryMobileNumber;
    }

    const actualLastFour = matchedNumber.slice(-4);
    if (actualLastFour !== lastFourDigits) throw new AppError('Last four digits mismatch', 400);
    if (!parent.isPasswordSet) throw new AppError('Parent has not completed onboarding yet', 400);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await parentRepository.updateOne(
        { _id: parent._id },
        { $set: { passwordHash: null, isPasswordSet: false } },
        { session }
      );
      await AuditService.log(
        { performedBy, targetParentId: parent._id, action: 'PARENT_PASSWORD_RESET', details: {} },
        session
      );
      await session.commitTransaction();
      return true;
    } catch (e) {
      await session.abortTransaction();
      logger.error('ParentService.resetParentPassword error', e);
      throw e;
    } finally {
      session.endSession();
    }
  }
}

export default ParentService;
