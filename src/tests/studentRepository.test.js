// src/tests/studentRepository.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { connect, disconnect, clearCollections } from './helpers/dbHelper.js';
import studentRepository from '../repositories/studentRepository.js';
import Parent from '../models/Parent.js';

const validStudent = {
  parentId: new mongoose.Types.ObjectId(),
  studentCode: 'STU001',
  studentName: 'Aarav Shah',
  medium: 'English',
  standard: '5',
  division: 'A',
  transportType: 'None',
};

beforeAll(connect);
afterAll(disconnect);
afterEach(clearCollections);

describe('studentRepository', () => {
  it('creates a student document', async () => {
    const doc = await studentRepository.create(validStudent);
    expect(doc._id).toBeDefined();
    expect(doc.studentName).toBe('Aarav Shah');
  });

  it('findById returns the created student', async () => {
    const created = await studentRepository.create(validStudent);
    const found = await studentRepository.findById(created._id);
    expect(found).not.toBeNull();
    expect(found.studentCode).toBe('STU001');
  });

  it('findById returns null for unknown id', async () => {
    const result = await studentRepository.findById(new mongoose.Types.ObjectId());
    expect(result).toBeNull();
  });

  it('updateOne modifies a field', async () => {
    const created = await studentRepository.create(validStudent);
    await studentRepository.updateOne({ _id: created._id }, { $set: { standard: '6' } });
    const updated = await studentRepository.findById(created._id);
    expect(updated.standard).toBe('6');
  });

  it('deleteOne removes a document', async () => {
    const created = await studentRepository.create(validStudent);
    await studentRepository.deleteOne({ _id: created._id });
    const found = await studentRepository.findById(created._id);
    expect(found).toBeNull();
  });

  it('countDocuments returns correct count', async () => {
    await studentRepository.create(validStudent);
    const count = await studentRepository.countDocuments({});
    expect(count).toBe(1);
  });
});
