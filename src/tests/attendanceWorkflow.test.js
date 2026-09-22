import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import AttendanceController from '../controllers/AttendanceController.js';
import Attendance from '../models/Attendance.js';
import AcademicYear from '../models/AcademicYear.js';
import ClassTeacherAllocation from '../models/ClassTeacherAllocation.js';
import Notification from '../models/Notification.js';
import Student from '../models/Student.js';
import Parent from '../models/Parent.js';
import User from '../models/User.js';

let mongoServer;

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function call(fn, req) {
  const res = mockRes();
  let err = null;
  await fn(req, res, (e) => { err = e; });
  if (err) throw err;
  return res;
}

const DATE = '2026-09-21';
let year, teacher, otherTeacher, admin, parent, s1, s2;

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([Attendance, AcademicYear, ClassTeacherAllocation, Notification, Student, Parent, User]
    .map((m) => m.deleteMany({})));

  year = await AcademicYear.create({ name: '2026-2027', startDate: new Date('2026-06-01'), endDate: new Date('2027-03-31'), isActive: true });
  teacher = await User.create({ name: 'Teach A', email: 'a@t.com', passwordHash: 'hash', role: 'TEACHER', contactNo1: '9000000001' });
  otherTeacher = await User.create({ name: 'Teach B', email: 'b@t.com', passwordHash: 'hash', role: 'TEACHER', contactNo1: '9000000002' });
  admin = await User.create({ name: 'Admin', email: 'ad@t.com', passwordHash: 'hash', role: 'ADMIN' });
  await ClassTeacherAllocation.create({ academicYearId: year._id, teacherId: teacher._id, standard: '5', division: 'A', medium: 'English' });

  parent = await Parent.create({ parentName: 'Par', primaryMobileNumber: '9111111111' });
  const base = { parentId: parent._id, standard: '5', division: 'A', medium: 'English', isMigrated: true, isActive: true };
  s1 = await Student.create({ ...base, studentName: 'Kid One', studentCode: 'T1' });
  s2 = await Student.create({ ...base, studentName: 'Kid Two', studentCode: 'T2' });
});

const asUser = (u, role) => ({ id: u._id.toString(), _id: u._id.toString(), role: role || u.role });
const body = (records) => ({ date: DATE, standard: '5', division: 'A', medium: 'English', records });
const recs = (a, b) => [
  { studentId: s1._id.toString(), status: a },
  { studentId: s2._id.toString(), status: b },
];

describe('attendance submit -> edit -> confirm workflow', () => {
  test('assigned teacher submits; sheet is SUBMITTED and parents are not notified', async () => {
    const res = await call(AttendanceController.saveAttendance, { user: asUser(teacher), body: body(recs('ABSENT', 'PRESENT')) });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('SUBMITTED');
    expect(await Notification.countDocuments()).toBe(0);
  });

  test('a teacher who is not the class teacher is rejected', async () => {
    await expect(
      call(AttendanceController.saveAttendance, { user: asUser(otherTeacher), body: body(recs('PRESENT', 'PRESENT')) })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('admin edit keeps the teacher as author and stays SUBMITTED', async () => {
    await call(AttendanceController.saveAttendance, { user: asUser(teacher), body: body(recs('ABSENT', 'PRESENT')) });
    const res = await call(AttendanceController.saveAttendance, { user: asUser(admin), body: body(recs('PRESENT', 'PRESENT')) });
    expect(res.body.data.status).toBe('SUBMITTED');
    expect(String(res.body.data.teacherId)).toBe(String(teacher._id));
    expect(String(res.body.data.lastEditedBy)).toBe(String(admin._id));
  });

  test('overview reports NOT_SUBMITTED, then SUBMITTED, then CONFIRMED with counts and teacher', async () => {
    const get = async () => (await call(AttendanceController.getOverview, { user: asUser(admin), query: { date: DATE } })).body.data[0];
    expect((await get()).status).toBe('NOT_SUBMITTED');
    expect((await get()).classTeacher.name).toBe('Teach A');

    await call(AttendanceController.saveAttendance, { user: asUser(teacher), body: body(recs('ABSENT', 'LATE')) });
    const submitted = await get();
    expect(submitted).toMatchObject({ status: 'SUBMITTED', absent: 1, late: 1, studentCount: 2 });

    await call(AttendanceController.confirmSheet, { user: asUser(admin), params: { id: String(submitted.attendanceId) } });
    expect((await get()).status).toBe('CONFIRMED');
  });

  test('confirm notifies absent/late parents once; re-confirm does not repeat', async () => {
    await call(AttendanceController.saveAttendance, { user: asUser(teacher), body: body(recs('ABSENT', 'LATE')) });
    const sheet = await Attendance.findOne();
    const first = await call(AttendanceController.confirmSheet, { user: asUser(admin), params: { id: String(sheet._id) } });
    expect(first.body.data.notified).toBe(2);
    const again = await call(AttendanceController.confirmSheet, { user: asUser(admin), params: { id: String(sheet._id) } });
    expect(again.body.data.notified).toBe(0);
  });

  test('teacher is locked out after confirmation; admin can still edit and only new absences notify', async () => {
    await call(AttendanceController.saveAttendance, { user: asUser(teacher), body: body(recs('ABSENT', 'PRESENT')) });
    const sheet = await Attendance.findOne();
    await call(AttendanceController.confirmSheet, { user: asUser(admin), params: { id: String(sheet._id) } });

    await expect(
      call(AttendanceController.saveAttendance, { user: asUser(teacher), body: body(recs('PRESENT', 'PRESENT')) })
    ).rejects.toMatchObject({ statusCode: 403 });

    await call(AttendanceController.saveAttendance, { user: asUser(admin), body: body(recs('ABSENT', 'ABSENT')) });
    const updated = await Attendance.findOne();
    expect(updated.status).toBe('CONFIRMED');
    expect(updated.records.every((r) => r.notifiedAt)).toBe(true);
  });

  test('parents only see confirmed sheets', async () => {
    await call(AttendanceController.saveAttendance, { user: asUser(teacher), body: body(recs('ABSENT', 'PRESENT')) });
    const req = () => ({ user: { id: parent._id.toString(), role: 'parent' }, params: { studentId: s1._id.toString() }, query: { month: '9', year: '2026' } });
    expect((await call(AttendanceController.getAttendanceForStudent, req())).body.data).toHaveLength(0);

    const sheet = await Attendance.findOne();
    await call(AttendanceController.confirmSheet, { user: asUser(admin), params: { id: String(sheet._id) } });
    expect((await call(AttendanceController.getAttendanceForStudent, req())).body.data).toHaveLength(1);
  });
});
