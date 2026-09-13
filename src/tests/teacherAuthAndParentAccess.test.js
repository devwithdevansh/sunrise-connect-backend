import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import AuthService from '../services/AuthService.js';
import verifyParentOwnsStudent from '../utils/verifyParentOwnsStudent.js';
import User from '../models/User.js';
import Parent from '../models/Parent.js';
import Student from '../models/Student.js';

let mongoServer;

async function makeUser(overrides) {
  const passwordHash = await bcrypt.hash('password123', 4); // low cost: test speed only
  return User.create({
    name: 'Test User',
    passwordHash,
    role: 'STAFF',
    ...overrides,
  });
}

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
  await User.ensureIndexes();
  await Parent.ensureIndexes();
  await Student.ensureIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Parent.deleteMany({});
  await Student.deleteMany({});
});

describe('Teacher web-portal lockout', () => {
  test('portalLogin rejects a TEACHER with a 403, even with correct credentials', async () => {
    await makeUser({ email: 'teach@school.com', role: 'TEACHER' });

    await expect(
      AuthService.portalLogin({ email: 'teach@school.com', password: 'password123' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('portalLogin still succeeds for STAFF and ADMIN', async () => {
    // Distinct contactNo1 values: the User schema's `default: null` on a
    // `sparse` unique index means two docs that both omit it collide anyway
    // (pre-existing schema quirk, not introduced by this change) — sidestep
    // it here rather than touching a shared model outside this plan's scope.
    await makeUser({ email: 'staff@school.com', contactNo1: '9111111111', role: 'STAFF' });
    await makeUser({ email: 'admin@school.com', contactNo1: '9222222222', role: 'ADMIN' });

    const staffResult = await AuthService.portalLogin({ email: 'staff@school.com', password: 'password123' });
    expect(staffResult.user.role).toBe('STAFF');

    const adminResult = await AuthService.portalLogin({ email: 'admin@school.com', password: 'password123' });
    expect(adminResult.user.role).toBe('ADMIN');
  });
});

describe('Teacher mobile login', () => {
  test('teacherLogin succeeds via contactNo1 for a TEACHER account', async () => {
    await makeUser({ contactNo1: '9876543210', role: 'TEACHER' });

    const result = await AuthService.teacherLogin({ contactNo1: '9876543210', password: 'password123' });
    expect(result.user.role).toBe('TEACHER');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  test('teacherLogin rejects STAFF/ADMIN accounts even with correct credentials', async () => {
    await makeUser({ contactNo1: '9876543211', role: 'STAFF' });

    await expect(
      AuthService.teacherLogin({ contactNo1: '9876543211', password: 'password123' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('teacherLogin rejects a wrong password', async () => {
    await makeUser({ contactNo1: '9876543212', role: 'TEACHER' });

    await expect(
      AuthService.teacherLogin({ contactNo1: '9876543212', password: 'wrongpassword' })
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('Parent ownership guard (used by Homework/Timetable/Exam/Attendance/Leave)', () => {
  test('resolves the student when the requesting parent owns them', async () => {
    const parent = await Parent.create({ parentName: 'P1', primaryMobileNumber: '9000000001', passwordHash: 'x' });
    const student = await Student.create({
      studentName: 'Kid One', studentCode: 'K1', parentId: parent._id,
      medium: 'English', standard: '5', division: 'A', isActive: true,
    });

    const req = { user: { id: parent._id.toString(), role: 'parent' } };
    const resolved = await verifyParentOwnsStudent(req, student._id.toString());
    expect(resolved.studentName).toBe('Kid One');
  });

  test('throws 404 when the student belongs to a different parent', async () => {
    const parentA = await Parent.create({ parentName: 'PA', primaryMobileNumber: '9000000002', passwordHash: 'x' });
    const parentB = await Parent.create({ parentName: 'PB', primaryMobileNumber: '9000000003', passwordHash: 'x' });
    const studentOfB = await Student.create({
      studentName: 'Kid Two', studentCode: 'K2', parentId: parentB._id,
      medium: 'English', standard: '5', division: 'A', isActive: true,
    });

    const reqA = { user: { id: parentA._id.toString(), role: 'parent' } };
    await expect(verifyParentOwnsStudent(reqA, studentOfB._id.toString())).rejects.toMatchObject({ statusCode: 404 });
  });

  test('throws 400 when studentId is missing', async () => {
    const parent = await Parent.create({ parentName: 'P3', primaryMobileNumber: '9000000004', passwordHash: 'x' });
    const req = { user: { id: parent._id.toString(), role: 'parent' } };
    await expect(verifyParentOwnsStudent(req, undefined)).rejects.toMatchObject({ statusCode: 400 });
  });
});
