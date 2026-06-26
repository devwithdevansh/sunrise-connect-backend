// src/tests/student.routes.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connect, disconnect } from './helpers/dbHelper.js';
import app from '../app.js';
import env from '../config/env.js';
import StudentService from '../services/StudentService.js';

let spyCreate, spyGet, spyList, spyUpdate;

function makeToken(role = 'ADMIN') {
  return jwt.sign({ id: '60d5ec4f0e213b2c2866b1a1', role }, env.JWT_SECRET, { expiresIn: '1h' });
}

const adminToken = makeToken('ADMIN');
const staffToken = makeToken('STAFF');
const parentToken = makeToken('parent');

beforeAll(async () => {
  await connect();
  spyCreate = jest.spyOn(StudentService, 'createStudent');
  spyGet    = jest.spyOn(StudentService, 'getStudent');
  spyList   = jest.spyOn(StudentService, 'listStudents');
  spyUpdate = jest.spyOn(StudentService, 'updateStudent');
});

afterAll(disconnect);
afterEach(() => jest.clearAllMocks());

describe('Student routes – auth guards', () => {
  it('GET /students returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/students');
    expect(res.status).toBe(401);
  });

  it('GET /students returns 200 for parent role', async () => {
    spyList.mockResolvedValueOnce([]);
    const res = await request(app)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/students – validation', () => {
  it('returns 400 on missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentName: 'John' }); // missing parentId, studentCode, etc
    expect(res.status).toBe(400);
  });

  it('calls createStudent and returns 201', async () => {
    spyCreate.mockResolvedValueOnce({ _id: 's1', studentName: 'John' });
    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ 
        parentId: 'p1', 
        studentCode: 'S001', 
        studentName: 'John Doe', 
        medium: 'English', 
        standard: '5', 
        division: 'A' 
      });
    expect(res.status).toBe(201);
    expect(spyCreate).toHaveBeenCalled();
  });
});

describe('GET /api/v1/students', () => {
  it('returns 200 with list', async () => {
    spyList.mockResolvedValueOnce([]);
    const res = await request(app)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
