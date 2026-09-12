import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import StudentController from '../controllers/StudentController.js';
import User from '../models/User.js';
import Student from '../models/Student.js';
import AcademicYear from '../models/AcademicYear.js';
import ClassTeacherAllocation from '../models/ClassTeacherAllocation.js';

let mongoServer;

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function callController(fn, req) {
  const res = mockRes();
  let caughtError = null;
  const next = (err) => { caughtError = err; };
  await fn(req, res, next);
  if (caughtError) throw caughtError;
  return res;
}

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
  await Student.deleteMany({});
  await AcademicYear.deleteMany({});
  await ClassTeacherAllocation.deleteMany({});
});

describe('StudentController.listStudents — TEACHER roster access', () => {
  test('a class teacher can list the roster of their own assigned class', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const teacher = await User.create({ name: 'Rana', passwordHash, role: 'TEACHER', contactNo1: '9499710732' });
    const year = await AcademicYear.create({ name: '2026-2027', startDate: new Date(), endDate: new Date(), isActive: true });
    await ClassTeacherAllocation.create({
      academicYearId: year._id, teacherId: teacher._id, standard: '1', division: 'A', medium: 'English',
    });
    await Student.create({
      studentName: 'Kid One', studentCode: 'K1', medium: 'English', standard: '1', division: 'A', isActive: true,
    });

    const req = {
      user: { id: teacher._id.toString(), _id: teacher._id, role: 'TEACHER' },
      query: { standard: '1', division: 'A', medium: 'English' },
    };
    const res = await callController(StudentController.listStudents, req);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].studentName).toBe('Kid One');
  });

  test('a teacher not assigned to the class is rejected with 403', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const teacher = await User.create({ name: 'Unassigned', passwordHash, role: 'TEACHER', contactNo1: '9499710733' });
    const year = await AcademicYear.create({ name: '2026-2027', startDate: new Date(), endDate: new Date(), isActive: true });

    const req = {
      user: { id: teacher._id.toString(), _id: teacher._id, role: 'TEACHER' },
      query: { standard: '1', division: 'A', medium: 'English' },
    };
    await expect(callController(StudentController.listStudents, req)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('a teacher must supply standard, division and medium', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const teacher = await User.create({ name: 'NoFilter', passwordHash, role: 'TEACHER', contactNo1: '9499710734' });

    const req = {
      user: { id: teacher._id.toString(), _id: teacher._id, role: 'TEACHER' },
      query: {},
    };
    await expect(callController(StudentController.listStudents, req)).rejects.toMatchObject({ statusCode: 400 });
  });
});
