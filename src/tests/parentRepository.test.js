// src/tests/parentRepository.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { connect, disconnect, clearCollections } from './helpers/dbHelper.js';
import parentRepository from '../repositories/parentRepository.js';

const validParent = {
  parentName: 'Ravi Shah',
  primaryMobileNumber: '9876543210',
  isPasswordSet: false,
};

beforeAll(connect);
afterAll(disconnect);
afterEach(clearCollections);

describe('parentRepository', () => {
  it('creates a parent document', async () => {
    const doc = await parentRepository.create(validParent);
    expect(doc._id).toBeDefined();
    expect(doc.parentName).toBe('Ravi Shah');
  });

  it('findById returns the created parent', async () => {
    const created = await parentRepository.create(validParent);
    const found = await parentRepository.findById(created._id);
    expect(found).not.toBeNull();
    expect(found.primaryMobileNumber).toBe('9876543210');
  });

  it('findOne returns parent by filter', async () => {
    await parentRepository.create(validParent);
    const found = await parentRepository.findOne({ primaryMobileNumber: '9876543210' });
    expect(found).not.toBeNull();
    expect(found.parentName).toBe('Ravi Shah');
  });

  it('findById returns null for unknown id', async () => {
    const { Types } = await import('mongoose');
    const result = await parentRepository.findById(new Types.ObjectId());
    expect(result).toBeNull();
  });

  it('updateOne modifies a field', async () => {
    const created = await parentRepository.create(validParent);
    await parentRepository.updateOne({ _id: created._id }, { $set: { parentName: 'Updated Name' } });
    const updated = await parentRepository.findById(created._id);
    expect(updated.parentName).toBe('Updated Name');
  });

  it('deleteOne removes a document', async () => {
    const created = await parentRepository.create(validParent);
    await parentRepository.deleteOne({ _id: created._id });
    const found = await parentRepository.findById(created._id);
    expect(found).toBeNull();
  });

  it('countDocuments returns correct count', async () => {
    await parentRepository.create(validParent);
    const count = await parentRepository.countDocuments({});
    expect(count).toBe(1);
  });

  it('find returns multiple documents', async () => {
    await parentRepository.create(validParent);
    await parentRepository.create({ ...validParent, primaryMobileNumber: '9000000001' });
    const results = await parentRepository.find({});
    expect(results.length).toBe(2);
  });
});
