// src/tests/auditRepository.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { connect, disconnect, clearCollections } from './helpers/dbHelper.js';
import auditRepository from '../repositories/auditRepository.js';
import '../models/User.js';
import '../models/Parent.js';
import '../models/Student.js';
import '../models/StudentFeeLedger.js';

beforeAll(connect);
afterAll(disconnect);
afterEach(clearCollections);

describe('auditRepository', () => {
  it('creates an audit entry', async () => {
    const doc = await auditRepository.create({
      performedBy: null,
      action: 'PARENT_CREATED',
      details: { test: true },
    });
    expect(doc._id).toBeDefined();
    expect(doc.action).toBe('PARENT_CREATED');
  });

  it('findById returns the audit entry', async () => {
    const created = await auditRepository.create({
      action: 'LEDGER_CREATED',
      details: {},
    });
    const found = await auditRepository.findById(created._id);
    expect(found).not.toBeNull();
    expect(found.action).toBe('LEDGER_CREATED');
  });

  it('find returns multiple audit entries', async () => {
    await auditRepository.create({ action: 'PARENT_CREATED', details: {} });
    await auditRepository.create({ action: 'PARENT_UPDATED', details: {} });
    const results = await auditRepository.find({});
    expect(results.length).toBe(2);
  });

  it('find filters by action', async () => {
    await auditRepository.create({ action: 'PARENT_CREATED', details: {} });
    await auditRepository.create({ action: 'PAYMENT_CREATED', details: {} });
    const results = await auditRepository.find({ action: 'PARENT_CREATED' });
    expect(results.length).toBe(1);
    expect(results[0].action).toBe('PARENT_CREATED');
  });
});
