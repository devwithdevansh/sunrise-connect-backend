// src/tests/LedgerService.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectReplica, disconnectReplica, clearCollections } from './helpers/replicaHelper.js';
import LedgerService from '../services/LedgerService.js';
import ledgerRepository from '../repositories/ledgerRepository.js';
import AuditService from '../services/AuditService.js';

jest.spyOn(AuditService, 'log').mockResolvedValue({});

const makeLedgerData = (overrides = {}) => ({
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
  ...overrides,
});

// Create ledger directly via repo to avoid catalog-change issue in setup
async function seedLedger(overrides = {}) {
  return ledgerRepository.create(makeLedgerData(overrides));
}

beforeAll(connectReplica);
afterAll(disconnectReplica);
afterEach(async () => {
  await clearCollections();
  jest.clearAllMocks();
});

describe('LedgerService', () => {
  describe('createLedger', () => {
    it('creates a ledger and emits LEDGER_CREATED audit', async () => {
      const ledger = await LedgerService.createLedger(makeLedgerData());
      expect(ledger._id).toBeDefined();
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LEDGER_CREATED' }), expect.anything()
      );
    });
  });

  describe('getLedger', () => {
    it('returns a ledger by id', async () => {
      const seeded = await seedLedger();
      const found = await LedgerService.getLedger(seeded._id);
      expect(found.totalAmount).toBe(5000);
    });

    it('throws 404 for unknown id', async () => {
      await expect(LedgerService.getLedger(new mongoose.Types.ObjectId()))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('addPayment', () => {
    it('updates paidAmount with OCC and emits audit', async () => {
      const ledger = await seedLedger();
      await LedgerService.addPayment({ ledgerId: ledger._id, amount: 2000 });
      const updated = await ledgerRepository.findById(ledger._id);
      expect(updated.paidAmount).toBe(2000);
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LEDGER_PAYMENT_ADDED' }), expect.anything()
      );
    });

    it('throws 400 on over-payment', async () => {
      const ledger = await seedLedger();
      await expect(LedgerService.addPayment({ ledgerId: ledger._id, amount: 9999 }))
        .rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 for non-positive amount', async () => {
      const ledger = await seedLedger();
      await expect(LedgerService.addPayment({ ledgerId: ledger._id, amount: 0 }))
        .rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('applyConcession', () => {
    it('updates concessionAmount with OCC and emits audit', async () => {
      const ledger = await seedLedger();
      await LedgerService.applyConcession({ ledgerId: ledger._id, amount: 500, reason: 'RTE' });
      const updated = await ledgerRepository.findById(ledger._id);
      expect(updated.concessionAmount).toBe(500);
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LEDGER_CONCESSION_APPLIED' }), expect.anything()
      );
    });

    it('throws 400 if concession exceeds remaining', async () => {
      const ledger = await seedLedger();
      await expect(LedgerService.applyConcession({ ledgerId: ledger._id, amount: 9999, reason: 'X' }))
        .rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('markAsPaid', () => {
    it('sets status to PAID when remaining is zero', async () => {
      const ledger = await seedLedger({ totalAmount: 1000, remainingAmount: 1000 });
      await LedgerService.addPayment({ ledgerId: ledger._id, amount: 1000 });
      await LedgerService.markAsPaid(ledger._id);
      const updated = await ledgerRepository.findById(ledger._id);
      expect(updated.status).toBe('PAID');
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LEDGER_STATUS_UPDATED' }), expect.anything()
      );
    });

    it('throws 400 if ledger is not fully settled', async () => {
      const ledger = await seedLedger();
      await expect(LedgerService.markAsPaid(ledger._id)).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
