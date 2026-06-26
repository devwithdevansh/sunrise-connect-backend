// src/tests/PaymentService.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectReplica, disconnectReplica, clearCollections } from './helpers/replicaHelper.js';
import PaymentService from '../services/PaymentService.js';
import paymentRepository from '../repositories/paymentRepository.js';
import ledgerRepository from '../repositories/ledgerRepository.js';
import AuditService from '../services/AuditService.js';

jest.spyOn(AuditService, 'log').mockResolvedValue({});

// Create ledger directly (no transaction) to avoid catalog-change errors in test setup
const makeLedgerData = () => ({
  studentId: new mongoose.Types.ObjectId(),
  academicYear: '2025-26',
  feeCategoryId: new mongoose.Types.ObjectId(),
  feePeriod: 'June',
  feeType: 'EDUCATION',
  ledgerNumber: `LDG-${Date.now()}-${Math.random()}`,
  totalAmount: 5000,
  paidAmount: 0,
  concessionAmount: 0,
  remainingAmount: 5000,
  status: 'PENDING',
  dueDate: new Date('2025-06-30'),
  source: 'GENERATED',
  generatedFrom: 'FEE_STRUCTURE',
  snapshot: { studentName: 'Test', medium: 'English', standard: '5', division: 'A', transportType: 'None', isRTE: false },
});

async function createTestLedger() {
  return ledgerRepository.create(makeLedgerData());
}

beforeAll(connectReplica);
afterAll(disconnectReplica);
afterEach(async () => {
  await clearCollections();
  jest.clearAllMocks();
});

describe('PaymentService', () => {
  describe('createPayment', () => {
    it('creates a payment and updates ledger paidAmount atomically', async () => {
      const ledger = await createTestLedger();
      const payment = await PaymentService.createPayment({ ledgerId: ledger._id, amount: 2000, method: 'CASH' });
      expect(payment._id).toBeDefined();
      expect(payment.amount).toBe(2000);
      const updatedLedger = await ledgerRepository.findById(ledger._id);
      expect(updatedLedger.paidAmount).toBe(2000);
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT_CREATED' }), expect.anything()
      );
    });

    it('throws 400 for over-payment', async () => {
      const ledger = await createTestLedger();
      await expect(PaymentService.createPayment({ ledgerId: ledger._id, amount: 9999, method: 'CASH' }))
        .rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 for non-positive amount', async () => {
      const ledger = await createTestLedger();
      await expect(PaymentService.createPayment({ ledgerId: ledger._id, amount: -100, method: 'CASH' }))
        .rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('reversePayment', () => {
    it('creates a reversal and decrements ledger paidAmount', async () => {
      const ledger = await createTestLedger();
      const payment = await PaymentService.createPayment({ ledgerId: ledger._id, amount: 2000, method: 'CASH' });
      const reversal = await PaymentService.reversePayment({ paymentId: payment._id, reason: 'Mistake' });
      expect(reversal.amount).toBe(-2000);
      expect(reversal.isReversal).toBe(true);
      const updatedLedger = await ledgerRepository.findById(ledger._id);
      expect(updatedLedger.paidAmount).toBe(0);
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT_REVERSED' }), expect.anything()
      );
    });

    it('throws 404 for unknown paymentId', async () => {
      await expect(PaymentService.reversePayment({ paymentId: new mongoose.Types.ObjectId(), reason: 'X' }))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 400 when reversing a reversal', async () => {
      const ledger = await createTestLedger();
      const payment = await PaymentService.createPayment({ ledgerId: ledger._id, amount: 1000, method: 'CASH' });
      const reversal = await PaymentService.reversePayment({ paymentId: payment._id, reason: 'Test' });
      await expect(PaymentService.reversePayment({ paymentId: reversal._id, reason: 'Double' }))
        .rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('getPayment', () => {
    it('returns a payment by id', async () => {
      const ledger = await createTestLedger();
      const payment = await PaymentService.createPayment({ ledgerId: ledger._id, amount: 500, method: 'UPI' });
      const found = await PaymentService.getPayment(payment._id);
      expect(found.amount).toBe(500);
    });

    it('throws 404 for unknown payment', async () => {
      await expect(PaymentService.getPayment(new mongoose.Types.ObjectId()))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
