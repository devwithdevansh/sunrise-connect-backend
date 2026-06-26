// src/tests/dashboard.routes.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connect, disconnect } from './helpers/dbHelper.js';
import app from '../app.js';
import env from '../config/env.js';
import DashboardService from '../services/DashboardService.js';

let spySystem, spyParent, spyStudent;

function makeToken(role = 'ADMIN') {
  return jwt.sign({ id: 'testuser', role }, env.JWT_SECRET, { expiresIn: '1h' });
}

const adminToken = makeToken('ADMIN');
const staffToken = makeToken('STAFF');
const parentToken = makeToken('parent');

beforeAll(async () => {
  await connect();
  spySystem  = jest.spyOn(DashboardService, 'getSystemMetrics');
  spyParent  = jest.spyOn(DashboardService, 'getParentDashboard');
  spyStudent = jest.spyOn(DashboardService, 'getStudentDashboard');
});

afterAll(disconnect);
afterEach(() => jest.clearAllMocks());

describe('GET /api/v1/dashboard/system', () => {
  it('returns 403 for STAFF', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/system')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it('calls service for ADMIN', async () => {
    spySystem.mockResolvedValueOnce({ totals: {} });
    const res = await request(app)
      .get('/api/v1/dashboard/system')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(spySystem).toHaveBeenCalled();
  });
});

describe('GET /api/v1/dashboard/parent/:id', () => {
  it('returns 200 for parent role (own ID)', async () => {
    spyParent.mockResolvedValueOnce({});
    const res = await request(app)
      .get('/api/v1/dashboard/parent/testuser')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
  });
});
