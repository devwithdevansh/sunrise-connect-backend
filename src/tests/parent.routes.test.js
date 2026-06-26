// src/tests/parent.routes.test.js
// Controller integration tests – mock ParentService, test HTTP contract only
import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connect, disconnect } from './helpers/dbHelper.js';
import app from '../app.js';
import env from '../config/env.js';
import ParentService from '../services/ParentService.js';

let spyCreate, spyGet, spyList, spyUpdate, spyReset;

function makeToken(role = 'ADMIN') {
  return jwt.sign({ id: 'testuser', role }, env.JWT_SECRET, { expiresIn: '1h' });
}

const adminToken = makeToken('ADMIN');
const staffToken = makeToken('STAFF');
const parentToken = makeToken('parent');

beforeAll(async () => {
  await connect();
  spyCreate = jest.spyOn(ParentService, 'createParent');
  spyGet    = jest.spyOn(ParentService, 'getParent');
  spyList   = jest.spyOn(ParentService, 'listParents');
  spyUpdate = jest.spyOn(ParentService, 'updateParent');
  spyReset  = jest.spyOn(ParentService, 'resetParentPassword');
});

afterAll(disconnect);
afterEach(() => jest.clearAllMocks());

describe('Parent routes – auth guards', () => {
  it('GET /parents returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/parents');
    expect(res.status).toBe(401);
    expect(spyList).not.toHaveBeenCalled();
  });

  it('GET /parents returns 403 for parent role', async () => {
    const res = await request(app)
      .get('/api/v1/parents')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/parents – validation', () => {
  it('returns 400 on missing parentName', async () => {
    const res = await request(app)
      .post('/api/v1/parents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ primaryMobileNumber: '9876543210' });
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid mobile number', async () => {
    const res = await request(app)
      .post('/api/v1/parents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parentName: 'Test', primaryMobileNumber: '123' });
    expect(res.status).toBe(400);
  });

  it('calls createParent and returns 201', async () => {
    spyCreate.mockResolvedValueOnce({ _id: 'p1', parentName: 'Test' });
    const res = await request(app)
      .post('/api/v1/parents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parentName: 'Test', primaryMobileNumber: '9876543210' });
    expect(res.status).toBe(201);
    expect(spyCreate).toHaveBeenCalled();
  });
});

describe('GET /api/v1/parents', () => {
  it('returns 200 with data from service', async () => {
    spyList.mockResolvedValueOnce([]);
    const res = await request(app)
      .get('/api/v1/parents')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/v1/parents/:id', () => {
  it('returns 200 for admin', async () => {
    spyGet.mockResolvedValueOnce({ _id: 'p1', parentName: 'Test' });
    const res = await request(app)
      .get('/api/v1/parents/p1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 200 for parent role (own record)', async () => {
    spyGet.mockResolvedValueOnce({ _id: 'p1', parentName: 'Test' });
    const res = await request(app)
      .get('/api/v1/parents/p1')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/parents/reset-password', () => {
  it('returns 403 for STAFF role', async () => {
    const res = await request(app)
      .post('/api/v1/parents/reset-password')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ primaryMobileNumber: '9876543210', lastFourDigits: '3210' });
    expect(res.status).toBe(403);
    expect(spyReset).not.toHaveBeenCalled();
  });

  it('calls service and returns 200 for admin', async () => {
    spyReset.mockResolvedValueOnce(true);
    const res = await request(app)
      .post('/api/v1/parents/reset-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ primaryMobileNumber: '9876543210', lastFourDigits: '3210' });
    expect(res.status).toBe(200);
    expect(spyReset).toHaveBeenCalled();
  });
});
