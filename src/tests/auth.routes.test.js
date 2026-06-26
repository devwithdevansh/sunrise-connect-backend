// src/tests/auth.routes.test.js
// Controller integration tests – spy on AuthService static methods, test HTTP contract
import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { connect, disconnect } from './helpers/dbHelper.js';
import app from '../app.js';
import AuthService from '../services/AuthService.js';

// Spy on each static method so Jest can intercept calls
let spyPortalLogin, spyVerify, spySetPassword, spyParentLogin, spyRotate;

beforeAll(async () => {
  await connect();
  spyPortalLogin   = jest.spyOn(AuthService, 'portalLogin');
  spyVerify        = jest.spyOn(AuthService, 'verifyParentLastFour');
  spySetPassword   = jest.spyOn(AuthService, 'setParentPassword');
  spyParentLogin   = jest.spyOn(AuthService, 'parentLogin');
  spyRotate        = jest.spyOn(AuthService, 'rotateRefreshToken');
});

afterAll(disconnect);
afterEach(() => jest.clearAllMocks());

describe('POST /api/v1/auth/portal/login', () => {
  it('returns 400 on missing email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/portal/login')
      .send({ password: 'secret123' });
    expect(res.status).toBe(400);
    expect(spyPortalLogin).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/portal/login')
      .send({ email: 'notanemail', password: 'secret123' });
    expect(res.status).toBe(400);
    expect(spyPortalLogin).not.toHaveBeenCalled();
  });

  it('calls AuthService.portalLogin and returns 200 on success', async () => {
    spyPortalLogin.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
    const res = await request(app)
      .post('/api/v1/auth/portal/login')
      .send({ email: 'admin@school.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(spyPortalLogin).toHaveBeenCalledWith({ email: 'admin@school.com', password: 'secret123' });
  });

  it('propagates service errors to global error handler', async () => {
    spyPortalLogin.mockRejectedValueOnce(
      Object.assign(new Error('Invalid credentials'), { statusCode: 401, isOperational: true })
    );
    const res = await request(app)
      .post('/api/v1/auth/portal/login')
      .send({ email: 'admin@school.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/parent/verify', () => {
  it('returns 400 on invalid mobile number', async () => {
    const res = await request(app)
      .post('/api/v1/auth/parent/verify')
      .send({ primaryMobileNumber: '123', lastFourDigits: '1234' });
    expect(res.status).toBe(400);
    expect(spyVerify).not.toHaveBeenCalled();
  });

  it('returns 400 on wrong lastFourDigits length', async () => {
    const res = await request(app)
      .post('/api/v1/auth/parent/verify')
      .send({ primaryMobileNumber: '9876543210', lastFourDigits: '12' });
    expect(res.status).toBe(400);
  });

  it('calls service on valid input', async () => {
    spyVerify.mockResolvedValueOnce({ success: true, parentId: 'abc' });
    const res = await request(app)
      .post('/api/v1/auth/parent/verify')
      .send({ primaryMobileNumber: '9876543210', lastFourDigits: '3210' });
    expect(res.status).toBe(200);
    expect(spyVerify).toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('returns 400 on invalid domain', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ domain: 'invalid', userId: 'x', refreshToken: 'y' });
    expect(res.status).toBe(400);
    expect(spyRotate).not.toHaveBeenCalled();
  });

  it('returns 400 on missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ domain: 'parent' });
    expect(res.status).toBe(400);
  });
});

describe('Protected auth routes – unauthenticated', () => {
  it('POST /logout returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/auth/logout').send({});
    expect(res.status).toBe(401);
  });

  it('POST /logout-all returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/auth/logout-all').send({});
    expect(res.status).toBe(401);
  });
});
