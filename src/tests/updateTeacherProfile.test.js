import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import UserService from '../services/UserService.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
  await User.ensureIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await AuditLog.deleteMany({});
});

describe('UserService.updateTeacherProfile', () => {
  test('promotes a STAFF user to TEACHER and persists permissions without crashing', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const user = await User.create({ name: 'Rana', passwordHash, role: 'STAFF', contactNo1: '9499710732' });

    const result = await UserService.updateTeacherProfile(user._id.toString(), {
      role: 'TEACHER',
      permissions: ['MARK_ATTENDANCE', 'ENTER_MARKS', 'APPROVE_LEAVE'],
    });

    expect(result.role).toBe('TEACHER');
    expect(result.permissions).toEqual(['MARK_ATTENDANCE', 'ENTER_MARKS', 'APPROVE_LEAVE']);

    const reloaded = await User.findById(user._id);
    expect(reloaded.role).toBe('TEACHER');
    expect(reloaded.permissions).toEqual(['MARK_ATTENDANCE', 'ENTER_MARKS', 'APPROVE_LEAVE']);

    const logEntry = await AuditLog.findOne({ action: 'TEACHER_PROFILE_UPDATED' });
    expect(logEntry).not.toBeNull();
  });

  test('updating permissions only leaves the existing role untouched', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const user = await User.create({ name: 'Existing Teacher', passwordHash, role: 'TEACHER', contactNo1: '9499710733' });

    const result = await UserService.updateTeacherProfile(user._id.toString(), {
      permissions: ['APPROVE_LEAVE'],
    });

    expect(result.role).toBe('TEACHER');
    const reloaded = await User.findById(user._id);
    expect(reloaded.role).toBe('TEACHER');
    expect(reloaded.permissions).toEqual(['APPROVE_LEAVE']);
  });

  test('rejects an invalid role', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const user = await User.create({ name: 'Someone', passwordHash, role: 'STAFF', contactNo1: '9499710734' });

    await expect(
      UserService.updateTeacherProfile(user._id.toString(), { role: 'ADMIN' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
