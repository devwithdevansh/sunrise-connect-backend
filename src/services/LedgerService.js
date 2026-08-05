// src/services/LedgerService.js
// Ledger business logic – OCC, financial integrity, audit coverage only for state changes

import mongoose from 'mongoose';
import ledgerRepository from '../repositories/ledgerRepository.js';
import AuditService from './AuditService.js';
import logger from '../config/logger.js';
import AppError from '../utils/AppError.js';

class LedgerService {
  /** Create a new ledger */
  static async createLedger(data) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const ledger = await ledgerRepository.create(data, { session });
      await AuditService.log(
        { performedBy: null, targetLedgerId: ledger._id, action: 'LEDGER_CREATED', details: {} },
        session
      );
      await session.commitTransaction();
      return ledger;
    } catch (err) {
      await session.abortTransaction();
      logger.error('LedgerService.createLedger error', err);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /** Read‑only fetch */
  static async getLedger(ledgerId) {
    const ledger = await ledgerRepository.findById(ledgerId);
    if (!ledger) throw new AppError('Ledger not found', 404);
    return ledger;
  }

  /** List ledgers with filters */
  static async listLedgers(filter = {}, pagination = { limit: 20, skip: 0 }) {
    return ledgerRepository.find(filter, null, pagination);
  }

  /** Add payment amount – OCC safe */
  static async addPayment({ ledgerId, amount, session: existingSession = null, details = {} }) {
    if (amount <= 0) throw new AppError('Amount must be positive', 400);
    const session = existingSession || await mongoose.startSession();
    const ownSession = !existingSession;
    if (ownSession) session.startTransaction();
    try {
      const ledger = await ledgerRepository.findById(ledgerId, null, { session });
      if (!ledger) throw new AppError('Ledger not found', 404);

      const newPaid = ledger.paidAmount + amount;
      const remaining = ledger.totalAmount - newPaid - ledger.concessionAmount;
      if (remaining < 0) throw new AppError('Over‑payment not allowed', 400);

      const status = remaining === 0 ? 'PAID' : 'PARTIAL';

      const result = await ledgerRepository.updateOne(
        { _id: ledgerId, __v: ledger.__v },
        { $set: { paidAmount: newPaid, remainingAmount: remaining, status }, $inc: { __v: 1 } },
        { session }
      );
      if (result.modifiedCount !== 1) throw new AppError('Concurrency conflict', 409);

      await AuditService.log(
        { performedBy: null, targetLedgerId: ledgerId, action: 'LEDGER_PAYMENT_ADDED', details: { amount, ...details } },
        session
      );
      if (ownSession) await session.commitTransaction();
      return ledgerRepository.findById(ledgerId);
    } catch (e) {
      if (ownSession) await session.abortTransaction();
      logger.error('LedgerService.addPayment error', e);
      throw e;
    } finally {
      if (ownSession) session.endSession();
    }
  }

  /** Apply concession – OCC safe */
  static async applyConcession({ ledgerId, amount, reason }) {
    if (amount <= 0) throw new AppError('Concession amount must be positive', 400);
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const ledger = await ledgerRepository.findById(ledgerId, null, { session });
      if (!ledger) throw new AppError('Ledger not found', 404);

      const newConcession = ledger.concessionAmount + amount;
      const remaining = ledger.totalAmount - ledger.paidAmount - newConcession;
      if (remaining < 0) throw new AppError('Concession exceeds remaining amount', 400);

      const status = remaining === 0 ? 'PAID' : ledger.paidAmount > 0 ? 'PARTIAL' : 'PENDING';

      const result = await ledgerRepository.updateOne(
        { _id: ledgerId, __v: ledger.__v },
        { $set: { concessionAmount: newConcession, remainingAmount: remaining, status }, $inc: { __v: 1 } },
        { session }
      );
      if (result.modifiedCount !== 1) throw new AppError('Concurrency conflict', 409);

      await AuditService.log(
        { performedBy: null, targetLedgerId: ledgerId, action: 'LEDGER_CONCESSION_APPLIED', details: { amount, reason } },
        session
      );
      await session.commitTransaction();
      return ledgerRepository.findById(ledgerId);
    } catch (e) {
      await session.abortTransaction();
      logger.error('LedgerService.applyConcession error', e);
      throw e;
    } finally {
      session.endSession();
    }
  }

  /** Mark ledger as paid when remaining amount is zero */
  static async markAsPaid(ledgerId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const ledger = await ledgerRepository.findById(ledgerId, null, { session });
      if (!ledger) throw new AppError('Ledger not found', 404);
      const remaining = ledger.totalAmount - ledger.paidAmount - ledger.concessionAmount;
      if (remaining !== 0) throw new AppError('Ledger not fully settled', 400);

      const result = await ledgerRepository.updateOne(
        { _id: ledgerId, __v: ledger.__v },
        { $set: { status: 'PAID' }, $inc: { __v: 1 } },
        { session }
      );
      if (result.modifiedCount !== 1) throw new AppError('Concurrency conflict', 409);

      await AuditService.log(
        { performedBy: null, targetLedgerId: ledgerId, action: 'LEDGER_STATUS_UPDATED', details: { status: 'PAID' } },
        session
      );
      await session.commitTransaction();
      return ledgerRepository.findById(ledgerId);
    } catch (e) {
      await session.abortTransaction();
      logger.error('LedgerService.markAsPaid error', e);
      throw e;
    } finally {
      session.endSession();
    }
  }
}

export default LedgerService;
