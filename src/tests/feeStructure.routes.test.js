// src/tests/feeStructure.routes.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connect, disconnect, clearCollections } from './helpers/dbHelper.js';
import app from '../app.js';
import env from '../config/env.js';
import FeeStructure from '../models/FeeStructure.js';
import TransportFeeStructure from '../models/TransportFeeStructure.js';

function makeToken(role = 'ADMIN') {
  return jwt.sign({ id: '60d5ec4f0e213b2c2866b1a1', role }, env.JWT_SECRET, { expiresIn: '1h' });
}

const adminToken = makeToken('ADMIN');

beforeAll(async () => {
  await connect();
});

afterAll(disconnect);

afterEach(async () => {
  await clearCollections();
});

describe('GET /api/v1/fee-structures', () => {
  it('returns 200 with fee structures and transport structures', async () => {
    // Seed data
    await FeeStructure.create({
      medium: 'English',
      standard: '5',
      annualFee: 36000,
      educationPartCount: 12,
      termPartCount: 2,
      isActive: true,
      applicableFeeCategories: [],
    });
    await TransportFeeStructure.create({
      transportType: 'Railnagar',
      amount: 600,
      frequency: 'MONTHLY',
      isActive: true,
    });

    const res = await request(app)
      .get('/api/v1/fee-structures')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.feeStructures).toHaveLength(1);
    expect(res.body.data.transportStructures).toHaveLength(1);
  });
});

describe('PUT /api/v1/fee-structures/:id – update standard fee', () => {
  it('returns 200 and updates the annualFee in the database', async () => {
    const created = await FeeStructure.create({
      medium: 'Gujarati',
      standard: '3',
      annualFee: 30000,
      educationPartCount: 12,
      termPartCount: 2,
      isActive: true,
      applicableFeeCategories: [],
    });

    const res = await request(app)
      .put(`/api/v1/fee-structures/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ annualFee: 32000, educationPartCount: 12, termPartCount: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.annualFee).toBe(32000);

    // Verify persisted
    const reloaded = await FeeStructure.findById(created._id).lean();
    expect(reloaded.annualFee).toBe(32000);
  });

  it('returns 400 when annualFee is negative', async () => {
    const created = await FeeStructure.create({
      medium: 'English',
      standard: '1',
      annualFee: 36000,
      educationPartCount: 12,
      termPartCount: 2,
      isActive: true,
      applicableFeeCategories: [],
    });

    const res = await request(app)
      .put(`/api/v1/fee-structures/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ annualFee: -5000 });

    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent fee structure id', async () => {
    const fakeId = '000000000000000000000001';
    const res = await request(app)
      .put(`/api/v1/fee-structures/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ annualFee: 40000 });

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/fee-structures/transport/:id – update transport fee', () => {
  it('returns 200 and updates the transport amount in the database', async () => {
    const created = await TransportFeeStructure.create({
      transportType: 'Outside Railnagar',
      amount: 900,
      frequency: 'MONTHLY',
      isActive: true,
    });

    const res = await request(app)
      .put(`/api/v1/fee-structures/transport/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(1000);

    // Verify persisted
    const reloaded = await TransportFeeStructure.findById(created._id).lean();
    expect(reloaded.amount).toBe(1000);
  });

  it('returns 400 when amount is negative', async () => {
    const created = await TransportFeeStructure.create({
      transportType: 'Railnagar',
      amount: 600,
      frequency: 'MONTHLY',
      isActive: true,
    });

    const res = await request(app)
      .put(`/api/v1/fee-structures/transport/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: -200 });

    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent transport structure id', async () => {
    const fakeId = '000000000000000000000002';
    const res = await request(app)
      .put(`/api/v1/fee-structures/transport/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 800 });

    expect(res.status).toBe(404);
  });
});
