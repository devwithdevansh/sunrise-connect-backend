// src/tests/ParentService.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectReplica, disconnectReplica, clearCollections } from './helpers/replicaHelper.js';
import ParentService from '../services/ParentService.js';
import parentRepository from '../repositories/parentRepository.js';
import AuditService from '../services/AuditService.js';

// Mock AuditService so tests don't need to write real audit documents
jest.spyOn(AuditService, 'log').mockResolvedValue({});

// Each test uses a unique mobile number to avoid uniqueness conflicts
let counter = 9000000000;
function uniqueMobile() { return String(counter++); }

beforeAll(connectReplica);
afterAll(disconnectReplica);
afterEach(async () => {
  await clearCollections();
  jest.clearAllMocks();
});

describe('ParentService', () => {
  describe('createParent', () => {
    it('creates a parent and emits PARENT_CREATED audit', async () => {
      const parent = await ParentService.createParent({
        parentName: 'Test Parent',
        primaryMobileNumber: uniqueMobile(),
      });
      expect(parent._id).toBeDefined();
      expect(parent.parentName).toBe('Test Parent');
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PARENT_CREATED' }),
        expect.anything()
      );
    });
  });

  describe('getParent', () => {
    it('returns a parent by id', async () => {
      const created = await ParentService.createParent({
        parentName: 'Fetch Test',
        primaryMobileNumber: uniqueMobile(),
      });
      const found = await ParentService.getParent(created._id);
      expect(found.parentName).toBe('Fetch Test');
    });

    it('throws 404 for unknown id', async () => {
      await expect(ParentService.getParent(new mongoose.Types.ObjectId()))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('updateParent', () => {
    it('updates fields and emits PARENT_UPDATED audit', async () => {
      const created = await ParentService.createParent({
        parentName: 'Before',
        primaryMobileNumber: uniqueMobile(),
      });
      await ParentService.updateParent(created._id, { parentName: 'After' });
      const updated = await parentRepository.findById(created._id);
      expect(updated.parentName).toBe('After');
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PARENT_UPDATED' }),
        expect.anything()
      );
    });
  });

  describe('listParents', () => {
    it('returns all parents', async () => {
      await ParentService.createParent({ parentName: 'A', primaryMobileNumber: uniqueMobile() });
      await ParentService.createParent({ parentName: 'B', primaryMobileNumber: uniqueMobile() });
      const list = await ParentService.listParents();
      expect(list.length).toBe(2);
    });
  });

  describe('resetParentPassword', () => {
    it('throws 400 if isPasswordSet is false (not yet onboarded)', async () => {
      const mobile = uniqueMobile();
      await ParentService.createParent({ parentName: 'ResetTest', primaryMobileNumber: mobile });
      const lastFour = mobile.slice(-4);
      await expect(
        ParentService.resetParentPassword({ primaryMobileNumber: mobile, lastFourDigits: lastFour })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 if last four digits are wrong', async () => {
      const mobile = uniqueMobile();
      const created = await ParentService.createParent({ parentName: 'ResetTest2', primaryMobileNumber: mobile });
      await parentRepository.updateOne({ _id: created._id }, { $set: { isPasswordSet: true } });
      await expect(
        ParentService.resetParentPassword({ primaryMobileNumber: mobile, lastFourDigits: '0000' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('resets password and emits PARENT_PASSWORD_RESET audit', async () => {
      const mobile = uniqueMobile();
      const lastFour = mobile.slice(-4);
      const created = await ParentService.createParent({ parentName: 'ResetTest3', primaryMobileNumber: mobile });
      await parentRepository.updateOne({ _id: created._id }, { $set: { isPasswordSet: true } });
      const result = await ParentService.resetParentPassword({
        primaryMobileNumber: mobile,
        lastFourDigits: lastFour,
      });
      expect(result).toBe(true);
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PARENT_PASSWORD_RESET' }),
        expect.anything()
      );
    });
  });
});
