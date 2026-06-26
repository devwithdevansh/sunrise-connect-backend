// src/tests/ledgerRepository.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connect, disconnect, clearCollections } from './helpers/dbHelper.js';
import ledgerRepository from '../repositories/ledgerRepository.js';

const validLedger = () => ({
  studentId: new mongoose.Types.ObjectId(),
  academicYear: '2025-26',
  feeCategoryId: new mongoose.Types.ObjectId(),
  feePeriod: 'June',
  feeType: 'EDUCATION',
  ledgerNumber: `LDG-${Date.now()}`,
  totalAmount: 5000,
  paidAmount: 0,
  concessionAmount: 0,
  remainingAmount: 5000,
  status: 'PENDING',
  dueDate: new Date('2025-06-30'),
  source: 'GENERATED',
  generatedFrom: 'FEE_STRUCTURE',
  snapshot: {
    studentName: 'Aarav Shah',
    medium: 'English',
    standard: '5',
    division: 'A',
    transportType: 'None',
    isRTE: false,
  },
});

beforeAll(connect);
afterAll(disconnect);
afterEach(clearCollections);

describe('ledgerRepository', () => {
  it('creates a ledger document', async () => {
    const doc = await ledgerRepository.create(validLedger());
    expect(doc._id).toBeDefined();
    expect(doc.totalAmount).toBe(5000);
  });

  it('findById returns the ledger', async () => {
    const created = await ledgerRepository.create(validLedger());
    const found = await ledgerRepository.findById(created._id);
    expect(found).not.toBeNull();
    expect(found.status).toBe('PENDING');
  });

  it('updateOne with __v OCC check increments version', async () => {
    const created = await ledgerRepository.create(validLedger());
    const original = await ledgerRepository.findById(created._id);
    const result = await ledgerRepository.updateOne(
      { _id: created._id, __v: original.__v },
      { $set: { paidAmount: 1000 }, $inc: { __v: 1 } }
    );
    expect(result.modifiedCount).toBe(1);
    const updated = await ledgerRepository.findById(created._id);
    expect(updated.paidAmount).toBe(1000);
    expect(updated.__v).toBe(original.__v + 1);
  });

  it('OCC prevents stale update (wrong __v)', async () => {
    const created = await ledgerRepository.create(validLedger());
    const result = await ledgerRepository.updateOne(
      { _id: created._id, __v: 999 },
      { $set: { paidAmount: 9999 }, $inc: { __v: 1 } }
    );
    expect(result.modifiedCount).toBe(0);
  });

  it('aggregate returns sum of totalAmount', async () => {
    await ledgerRepository.create(validLedger());
    await ledgerRepository.create({ ...validLedger(), ledgerNumber: `LDG-${Date.now() + 1}`, totalAmount: 3000, remainingAmount: 3000 });
    const agg = await ledgerRepository.aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    expect(agg[0].total).toBe(8000);
  });

  it('countDocuments returns correct count', async () => {
    await ledgerRepository.create(validLedger());
    const count = await ledgerRepository.countDocuments({});
    expect(count).toBe(1);
  });
});
