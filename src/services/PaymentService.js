// src/services/PaymentService.js
// Payment business logic – creates payments, handles reversals, links to ledgers
// All ledger updates happen inside the SAME session for atomicity (no cross-service session hand-off)

import mongoose from 'mongoose';
import AcademicYear from '../models/AcademicYear.js';
import paymentRepository from '../repositories/paymentRepository.js';
import ledgerRepository from '../repositories/ledgerRepository.js';
import AuditService from './AuditService.js';
import logger from '../config/logger.js';
import AppError from '../utils/AppError.js';

class PaymentService {
  /** Create a payment and atomically update the ledger paidAmount */
  static async createPayment({ ledgerId, amount, concessionAmount = 0, method, details = {}, performedBy = null }) {
    if (amount <= 0) throw new AppError('Payment amount must be positive', 400);
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // OCC: read ledger inside transaction
      const ledger = await ledgerRepository.findById(ledgerId, null, { session });
      if (!ledger) throw new AppError('Ledger not found', 404);

      const ayDoc = await AcademicYear.findOneAndUpdate(
        { name: ledger.academicYear },
        { $inc: { lastReceiptNumber: 1 } },
        { new: true, session }
      );
      if (!ayDoc) throw new AppError('Academic year not found for ledger', 404);
      const receiptNumber = ayDoc.lastReceiptNumber;

      const newPaid = ledger.paidAmount + amount;
      const newConcession = ledger.concessionAmount + concessionAmount;
      const remaining = ledger.totalAmount - newPaid - newConcession;
      if (remaining < 0) throw new AppError('Over‑payment not allowed', 400);

      const status = remaining === 0 ? 'PAID' : 'PARTIAL';
      // Insert payment record
      const payment = await paymentRepository.create({ ledgerId, amount, concessionAmount, method, details, receiptNumber }, { session });

      // Atomic OCC ledger update
      const updateResult = await ledgerRepository.updateOne(
        { _id: ledgerId, __v: ledger.__v },
        { $set: { paidAmount: newPaid, concessionAmount: newConcession, remainingAmount: remaining, status }, $inc: { __v: 1 } },
        { session }
      );
      if (updateResult.modifiedCount !== 1) throw new AppError('Concurrency conflict', 409);

      await AuditService.log(
        { performedBy, targetLedgerId: ledgerId, action: 'PAYMENT_CREATED', details: { paymentId: payment._id, amount, concessionAmount, method } },
        session
      );
      await session.commitTransaction();
      return payment;
    } catch (e) {
      await session.abortTransaction();
      logger.error('PaymentService.createPayment error', e);
      throw e;
    } finally {
      session.endSession();
    }
  }

  /** Create a batch of payments atomically inside a single Mongoose transaction */
  static async createBatchPayments({ payments, performedBy = null }) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const createdPayments = [];
      const batchTxnId = `BATCH_TXN_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      let batchReceiptNumber = null;

      for (const payData of payments) {
        const { ledgerId, amount, concessionAmount = 0, method, remark } = payData;

        // Find the ledger
        const ledger = await ledgerRepository.findById(ledgerId, null, { session });
        if (!ledger) throw new AppError(`Ledger not found for ID: ${ledgerId}`, 404);

        if (batchReceiptNumber === null && amount > 0) {
          const ayDoc = await AcademicYear.findOneAndUpdate(
            { name: ledger.academicYear },
            { $inc: { lastReceiptNumber: 1 } },
            { new: true, session }
          );
          if (!ayDoc) throw new AppError(`Academic year not found for ledger ${ledgerId}`, 404);
          batchReceiptNumber = ayDoc.lastReceiptNumber;
        }

        if (amount > 0) {
          const receiptNumber = batchReceiptNumber;

          // Process payment + concession
          const newPaid = ledger.paidAmount + amount;
          const newConcession = ledger.concessionAmount + concessionAmount;
          const remaining = ledger.totalAmount - newPaid - newConcession;
          if (remaining < 0) throw new AppError(`Over-payment not allowed for ledger ${ledgerId}`, 400);

          const status = remaining === 0 ? 'PAID' : 'PARTIAL';

          // Insert payment record
          const payment = await paymentRepository.create({
            ledgerId,
            receiptNumber,
            amount,
            concessionAmount,
            method,
            details: { remark, transactionId: batchTxnId }
          }, { session });

          // Atomic OCC ledger update
          const updateResult = await ledgerRepository.updateOne(
            { _id: ledgerId, __v: ledger.__v },
            { $set: { paidAmount: newPaid, concessionAmount: newConcession, remainingAmount: remaining, status }, $inc: { __v: 1 } },
            { session }
          );
          if (updateResult.modifiedCount !== 1) throw new AppError('Concurrency conflict', 409);

          await AuditService.log(
            { performedBy, targetLedgerId: ledgerId, action: 'PAYMENT_CREATED', details: { paymentId: payment._id, amount, concessionAmount, method } },
            session
          );

          createdPayments.push(payment);
        } else if (concessionAmount > 0) {
          // Process concession-only
          const newConcession = ledger.concessionAmount + concessionAmount;
          const remaining = ledger.totalAmount - ledger.paidAmount - newConcession;
          if (remaining < 0) throw new AppError(`Concession exceeds remaining amount for ledger ${ledgerId}`, 400);

          const status = remaining === 0 ? 'PAID' : ledger.paidAmount > 0 ? 'PARTIAL' : 'PENDING';

          // Atomic OCC ledger update
          const updateResult = await ledgerRepository.updateOne(
            { _id: ledgerId, __v: ledger.__v },
            { $set: { concessionAmount: newConcession, remainingAmount: remaining, status }, $inc: { __v: 1 } },
            { session }
          );
          if (updateResult.modifiedCount !== 1) throw new AppError('Concurrency conflict', 409);

          await AuditService.log(
            { performedBy, targetLedgerId: ledgerId, action: 'LEDGER_CONCESSION_APPLIED', details: { amount: concessionAmount, reason: remark || 'Concession applied' } },
            session
          );
        }
      }

      await session.commitTransaction();
      return createdPayments;
    } catch (e) {
      await session.abortTransaction();
      logger.error('PaymentService.createBatchPayments error', e);
      throw e;
    } finally {
      session.endSession();
    }
  }

  /** Reverse a payment – creates a reversal record and decrements ledger paidAmount */
  static async reversePayment({ paymentId, reason, performedBy = null }) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new AppError('A valid reversal reason is required', 400);
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const payment = await paymentRepository.findById(paymentId, null, { session });
      if (!payment) throw new AppError('Payment not found', 404);
      if (payment.isReversal) throw new AppError('Cannot reverse a reversal', 400);

      // Check if this payment is already reversed
      const existingReversal = await paymentRepository.findOne({
        $or: [
          { 'details.reversalOf': paymentId },
          { 'details.reversalOf': paymentId.toString() }
        ]
      }, null, { session });
      if (existingReversal) throw new AppError('Already reversed', 400);

      // OCC: read ledger inside transaction
      const ledger = await ledgerRepository.findById(payment.ledgerId, null, { session });
      if (!ledger) throw new AppError('Ledger not found', 404);

      const newPaid = ledger.paidAmount - payment.amount;
      if (newPaid < 0) throw new AppError('Ledger paid amount cannot become negative', 400);

      const concessionToReverse = payment.concessionAmount || 0;
      const newConcession = ledger.concessionAmount - concessionToReverse;
      
      const remaining = ledger.totalAmount - newPaid - newConcession;
      const status = remaining === 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'PENDING';

      // Create reversal record
      const reversal = await paymentRepository.create({
        ledgerId: payment.ledgerId,
        amount: -payment.amount,
        concessionAmount: -concessionToReverse,
        method: payment.method,
        details: { reversalOf: paymentId, reason },
        isReversal: true,
      }, { session });

      // OCC ledger decrement
      const result = await ledgerRepository.updateOne(
        { _id: ledger._id, __v: ledger.__v },
        { $set: { paidAmount: newPaid, remainingAmount: remaining, concessionAmount: newConcession, status }, $inc: { __v: 1 } },
        { session }
      );
      if (result.modifiedCount !== 1) throw new AppError('Concurrency conflict', 409);

      await AuditService.log(
        { performedBy, targetLedgerId: ledger._id, action: 'PAYMENT_REVERSED', details: { reversalId: reversal._id, reason } },
        session
      );
      await session.commitTransaction();
      return reversal;
    } catch (e) {
      await session.abortTransaction();
      logger.error('PaymentService.reversePayment error', e);
      throw e;
    } finally {
      session.endSession();
    }
  }

  /** Read‑only fetch payment */
  static async getPayment(paymentId) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new AppError('Payment not found', 404);
    return payment;
  }

  /** List payments with optional filters, populating ledger context */
  static async listPayments(filter = {}, pagination = { limit: 20, skip: 0 }) {
    return paymentRepository.findWithLedger(filter, pagination);
  }
}

export default PaymentService;
