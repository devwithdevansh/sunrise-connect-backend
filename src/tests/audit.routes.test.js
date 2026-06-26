// src/tests/audit.routes.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connect, disconnect } from './helpers/dbHelper.js';
import app from '../app.js';
import env from '../config/env.js';
import AuditService from '../services/AuditService.js';

let spySearch, spyGet;

function makeToken(role = 'ADMIN') {
  return jwt.sign({ id: 'testuser', role }, env.JWT_SECRET, { expiresIn: '1h' });
}

const adminToken = makeToken('ADMIN');
const staffToken = makeToken('STAFF');

beforeAll(async () => {
  await connect();
  spySearch = jest.spyOn(AuditService, 'search');
  spyGet    = jest.spyOn(AuditService, 'findById');
});

afterAll(disconnect);
afterEach(() => jest.clearAllMocks());

describe('Audit routes – ADMIN only guards', () => {
  it('returns 403 for STAFF', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it('calls service for ADMIN', async () => {
    spySearch.mockResolvedValueOnce({ logs: [], total: 0 });
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(spySearch).toHaveBeenCalled();
  });
});
