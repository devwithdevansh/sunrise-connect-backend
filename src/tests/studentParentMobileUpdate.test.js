import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import StudentService from '../services/StudentService.js';
import Parent from '../models/Parent.js';
import Student from '../models/Student.js';
import AcademicYear from '../models/AcademicYear.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1 }
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Ensure indexes are created before starting transactions
  await Parent.ensureIndexes();
  await Student.ensureIndexes();
  await AcademicYear.ensureIndexes();

  // Set up active academic year since StudentService checks for it
  await AcademicYear.create({
    name: '2026-2027',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2027-05-31'),
    isActive: true
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Parent.deleteMany({});
  await Student.deleteMany({});
});

describe('Student Parent Mobile Number Update & Separation Tests', () => {
  test('Sole child: Updating primary mobile number resets onboarding state and clears sessions', async () => {
    // 1. Create a parent that is already onboarded
    const parent = await Parent.create({
      parentName: 'Parent A',
      primaryMobileNumber: '9999999999',
      passwordHash: 'dummyhash',
      isPasswordSet: true,
      refreshTokens: [{ tokenHash: 'token1', expiresAt: new Date(Date.now() + 100000) }],
      fcmTokens: [{ token: 'fcm1', platform: 'android' }]
    });

    // 2. Create student linked to parent
    const student = await Student.create({
      studentName: 'Test Student',
      studentCode: 'STU001',
      parentId: parent._id,
      medium: 'English',
      standard: '1',
      division: 'A',
      isActive: true
    });

    // 3. Update the student's parent mobile number to a new number
    const updated = await StudentService.updateStudent(student._id, {
      parentMobile: '8888888888'
    });

    // 4. Verify parent was updated directly (since no siblings exist)
    const updatedParent = await Parent.findById(parent._id).select('+passwordHash');
    expect(updatedParent.primaryMobileNumber).toBe('8888888888');
    
    // Verify onboarding is reset
    expect(updatedParent.isPasswordSet).toBe(false);
    expect(updatedParent.passwordHash).not.toBe('dummyhash'); // password should be randomized/reset
    
    // Verify sessions are invalidated
    expect(updatedParent.refreshTokens.length).toBe(0);
    expect(updatedParent.fcmTokens.length).toBe(0);
  });

  test('Siblings: Updating primary mobile of one child splits parent to a new document, leaving sibling unaffected', async () => {
    // 1. Create parent
    const parent = await Parent.create({
      parentName: 'Shared Parent',
      primaryMobileNumber: '9999999999',
      passwordHash: 'dummyhash',
      isPasswordSet: true,
      refreshTokens: [{ tokenHash: 'token1', expiresAt: new Date(Date.now() + 100000) }],
      fcmTokens: [{ token: 'fcm1', platform: 'android' }]
    });

    // 2. Create two students sharing the parent
    const student1 = await Student.create({
      studentName: 'Test Student 1',
      studentCode: 'STU001',
      parentId: parent._id,
      medium: 'English',
      standard: '1',
      division: 'A',
      isActive: true
    });

    const student2 = await Student.create({
      studentName: 'Test Student 2',
      studentCode: 'STU002',
      parentId: parent._id,
      medium: 'English',
      standard: '2',
      division: 'B',
      isActive: true
    });

    // 3. Update primary mobile of student2 (Test Student 2)
    const updatedStudent2 = await StudentService.updateStudent(student2._id, {
      parentMobile: '7777777777',
      parentName: 'New Parent 2'
    });

    // 4. Verify student1 remains linked to the original parent with old mobile and unmodified state
    const originalParent = await Parent.findById(parent._id).select('+passwordHash');
    expect(originalParent.primaryMobileNumber).toBe('9999999999');
    expect(originalParent.isPasswordSet).toBe(true);
    expect(originalParent.passwordHash).toBe('dummyhash');
    expect(originalParent.refreshTokens.length).toBe(1);

    const s1 = await Student.findById(student1._id);
    expect(String(s1.parentId)).toBe(String(parent._id));

    // 5. Verify student2 is linked to a new parent document
    const s2 = await Student.findById(student2._id);
    expect(String(s2.parentId)).not.toBe(String(parent._id));

    const newParent = await Parent.findById(s2.parentId);
    expect(newParent.primaryMobileNumber).toBe('7777777777');
    expect(newParent.parentName).toBe('New Parent 2');
    expect(newParent.isPasswordSet).toBe(false);
    expect(newParent.refreshTokens.length).toBe(0);
    expect(newParent.fcmTokens.length).toBe(0);
  });

  test('Link to existing parent: Updating student mobile to a number of an existing parent links them directly', async () => {
    // 1. Create original parent
    const parent = await Parent.create({
      parentName: 'Old Parent',
      primaryMobileNumber: '9999999999',
      isPasswordSet: true,
      passwordHash: 'dummyhash'
    });

    // 2. Create existing parent that we want to link to
    const existingParent = await Parent.create({
      parentName: 'Existing Parent Target',
      primaryMobileNumber: '6666666666',
      isPasswordSet: true,
      passwordHash: 'targethash'
    });

    const student = await Student.create({
      studentName: 'Test Student',
      studentCode: 'STU001',
      parentId: parent._id,
      medium: 'English',
      standard: '1',
      division: 'A',
      isActive: true
    });

    // 3. Update student's parent mobile to match existingParent's mobile
    await StudentService.updateStudent(student._id, {
      parentMobile: '6666666666'
    });

    // 4. Verify student has been linked to the existing parent
    const s = await Student.findById(student._id);
    expect(String(s.parentId)).toBe(String(existingParent._id));

    // Verify existing parent details are unaffected (onboarding is still true)
    const targetParentDoc = await Parent.findById(existingParent._id).select('+passwordHash');
    expect(targetParentDoc.isPasswordSet).toBe(true);
    expect(targetParentDoc.passwordHash).toBe('targethash');
  });
});
