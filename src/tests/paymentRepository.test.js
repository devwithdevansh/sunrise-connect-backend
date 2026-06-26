// src/tests/paymentRepository.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connect, disconnect, clearCollections } from './helpers/dbHelper.js';
import paymentRepository from '../repositories/paymentRepository.js';

const validPayment = () => ({
  ledgerId: new mongoose.Types.ObjectId(),
  amount: 1000,
  method: 'CASH',
  details: { note: 'test payment' },
  isReversal: false,
});

beforeAll(connect);
afterAll(disconnect);
afterEach(clearCollections);

describe('paymentRepository', () => {
  it('creates a payment document', async () => {
    const doc = await paymentRepository.create(validPayment());
    expect(doc._id).toBeDefined();
    expect(doc.amount).toBe(1000);
  });

  it('findById returns the payment', async () => {
    const created = await paymentRepository.create(validPayment());
    const found = await paymentRepository.findById(created._id);
    expect(found).not.toBeNull();
    expect(found.method).toBe('CASH');
  });

  it('findById returns null for unknown id', async () => {
    const result = await paymentRepository.findById(new mongoose.Types.ObjectId());
    expect(result).toBeNull();
  });

  it('creates a reversal with negative amount', async () => {
    const reversal = await paymentRepository.create({
      ...validPayment(),
      amount: -1000,
      method: 'REVERSAL',
      isReversal: true,
    });
    expect(reversal.amount).toBe(-1000);
    expect(reversal.isReversal).toBe(true);
  });

  it('find returns multiple payments', async () => {
    const ledgerId = new mongoose.Types.ObjectId();
    await paymentRepository.create({ ...validPayment(), ledgerId });
    await paymentRepository.create({ ...validPayment(), ledgerId, amount: 500 });
    const results = await paymentRepository.find({ ledgerId });
    expect(results.length).toBe(2);
  });

  it('countDocuments returns correct count', async () => {
    await paymentRepository.create(validPayment());
    const count = await paymentRepository.countDocuments({});
    expect(count).toBe(1);
  });
});
