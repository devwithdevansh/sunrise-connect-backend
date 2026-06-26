// src/tests/payment.routes.test.js
// Controller integration tests – mock PaymentService, test HTTP contract
import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connect, disconnect } from './helpers/dbHelper.js';
import app from '../app.js';
import env from '../config/env.js';
import PaymentService from '../services/PaymentService.js';

let spyCreate, spyGet, spyList, spyReverse;

function makeToken(role = 'ADMIN') {
  return jwt.sign({ id: 'testuser', role }, env.JWT_SECRET, { expiresIn: '1h' });
}

const adminToken = makeToken('ADMIN');
const staffToken = makeToken('STAFF');

beforeAll(async () => {
  await connect();
  spyCreate  = jest.spyOn(PaymentService, 'createPayment');
  spyGet     = jest.spyOn(PaymentService, 'getPayment');
  spyList    = jest.spyOn(PaymentService, 'listPayments');
  spyReverse = jest.spyOn(PaymentService, 'reversePayment');
});

afterAll(disconnect);
afterEach(() => jest.clearAllMocks());

describe('POST /api/v1/payments – idempotency enforcement', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/payments').send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 on missing Idempotency-Key header', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ledgerId: 'abc', amount: 100, method: 'CASH' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Idempotency-Key/);
    expect(spyCreate).not.toHaveBeenCalled();
  });

  it('returns 400 on validation error (missing method)', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', 'idem-test-001')
      .send({ ledgerId: 'abc', amount: 100 });
    expect(res.status).toBe(400);
  });

  it('calls createPayment and returns 201', async () => {
    spyCreate.mockResolvedValueOnce({ _id: 'pay1', amount: 100 });
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', 'idem-test-002')
      .send({ ledgerId: 'abc123', amount: 100, method: 'CASH' });
    expect(res.status).toBe(201);
    expect(spyCreate).toHaveBeenCalled();
  });

  it('replays cached response on duplicate Idempotency-Key', async () => {
    spyCreate.mockResolvedValueOnce({ _id: 'pay2', amount: 200 });
    const key = 'idem-replay-key-' + Date.now();
    // First request
    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', key)
      .send({ ledgerId: 'abc123', amount: 200, method: 'CASH' });
    // Replay
    const replay = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', key)
      .send({ ledgerId: 'abc123', amount: 200, method: 'CASH' });
    expect(replay.status).toBe(201);
    // createPayment called only once (replay served from cache)
    expect(spyCreate).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/v1/payments/:id/reverse – role guard', () => {
  it('calls reversePayment and returns 200 for STAFF role', async () => {
    spyReverse.mockResolvedValueOnce({ _id: 'rev1', amount: -100 });
    const res = await request(app)
      .post('/api/v1/payments/pay1/reverse')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Mistake' });
    expect(res.status).toBe(200);
    expect(spyReverse).toHaveBeenCalledWith({ paymentId: 'pay1', reason: 'Mistake', performedBy: 'testuser' });
  });

  it('calls reversePayment and returns 200 for ADMIN', async () => {
    spyReverse.mockResolvedValueOnce({ _id: 'rev1', amount: -100 });
    const res = await request(app)
      .post('/api/v1/payments/pay1/reverse')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Mistake' });
    expect(res.status).toBe(200);
    expect(spyReverse).toHaveBeenCalledWith({ paymentId: 'pay1', reason: 'Mistake', performedBy: 'testuser' });
  });
});

describe('GET /api/v1/payments', () => {
  it('returns 200 with list', async () => {
    spyList.mockResolvedValueOnce([]);
    const res = await request(app)
      .get('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
