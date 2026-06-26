// src/tests/ledger.routes.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connect, disconnect } from './helpers/dbHelper.js';
import app from '../app.js';
import env from '../config/env.js';
import LedgerService from '../services/LedgerService.js';

let spyCreate, spyGet, spyList, spyAddPayment, spyApplyConcession, spyMarkPaid;

function makeToken(role = 'ADMIN') {
  return jwt.sign({ id: 'testuser', role }, env.JWT_SECRET, { expiresIn: '1h' });
}

const adminToken = makeToken('ADMIN');
const staffToken = makeToken('STAFF');

beforeAll(async () => {
  await connect();
  spyCreate          = jest.spyOn(LedgerService, 'createLedger');
  spyGet             = jest.spyOn(LedgerService, 'getLedger');
  spyList            = jest.spyOn(LedgerService, 'listLedgers');
  spyAddPayment      = jest.spyOn(LedgerService, 'addPayment');
  spyApplyConcession = jest.spyOn(LedgerService, 'applyConcession');
  spyMarkPaid        = jest.spyOn(LedgerService, 'markAsPaid');
});

afterAll(disconnect);
afterEach(() => jest.clearAllMocks());

describe('Ledger routes – auth guards', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/ledgers');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/ledgers/:id/concession – ADMIN only', () => {
  it('returns 403 for STAFF', async () => {
    const res = await request(app)
      .post('/api/v1/ledgers/ledger123/concession')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ amount: 100, reason: 'Test' });
    expect(res.status).toBe(403);
  });

  it('calls service for ADMIN', async () => {
    spyApplyConcession.mockResolvedValueOnce({});
    const res = await request(app)
      .post('/api/v1/ledgers/ledger123/concession')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 100, reason: 'Test' });
    expect(res.status).toBe(200);
    expect(spyApplyConcession).toHaveBeenCalled();
  });
});

describe('GET /api/v1/ledgers', () => {
  it('returns 200 with list', async () => {
    spyList.mockResolvedValueOnce([]);
    const res = await request(app)
      .get('/api/v1/ledgers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
