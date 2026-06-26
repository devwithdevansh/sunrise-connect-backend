// src/tests/migration.routes.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connect, disconnect } from './helpers/dbHelper.js';
import app from '../app.js';
import env from '../config/env.js';
import MigrationService from '../services/MigrationService.js';

let spyMigrateParents, spyMigrateStudents;

function makeToken(role = 'ADMIN') {
  return jwt.sign({ id: 'testuser', role }, env.JWT_SECRET, { expiresIn: '1h' });
}

const adminToken = makeToken('ADMIN');
const staffToken = makeToken('STAFF');

beforeAll(async () => {
  await connect();
  spyMigrateParents  = jest.spyOn(MigrationService, 'migrateParents');
  spyMigrateStudents = jest.spyOn(MigrationService, 'migrateStudents');
});

afterAll(disconnect);
afterEach(() => jest.clearAllMocks());

describe('Migration routes – ADMIN only guards', () => {
  it('returns 403 for STAFF', async () => {
    const res = await request(app)
      .post('/api/v1/migration/parents')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ parents: [] });
    expect(res.status).toBe(403);
  });

  it('calls service for ADMIN', async () => {
    spyMigrateParents.mockResolvedValueOnce({ processed: 0, successes: 0, failures: [] });
    const res = await request(app)
      .post('/api/v1/migration/parents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parents: [] });
    expect(res.status).toBe(200);
    expect(spyMigrateParents).toHaveBeenCalled();
  });
});
