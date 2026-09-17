// backend/src/dev-seed-erp-demo.js
//
// Manual, LOCAL-ONLY dev utility. Spins up an ephemeral in-memory MongoDB
// (mongodb-memory-server — never touches the real MONGODB_URI or .env),
// seeds a small ERP demo tenant (academic year, curriculum, class teacher,
// timetable, two exams with results), then starts the real Express app
// against that in-memory database so the admin-frontend / Flutter app can
// be pointed at it for manual testing.
//
// Run with: node src/dev-seed-erp-demo.js
// Stop with Ctrl+C (tears down the in-memory database).

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

async function main() {
  const mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongoServer.getUri();

  // Must happen BEFORE anything imports config/env.js (which reads
  // process.env.MONGODB_URI at module-load time) — dynamic imports below
  // resolve after this line runs, so they pick up this value instead of
  // whatever is in the real .env file.
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'development';

  await mongoose.connect(uri);
  console.log(`\nConnected mongoose to ephemeral in-memory MongoDB at ${uri}\n`);

  const User = (await import('./models/User.js')).default;
  const Parent = (await import('./models/Parent.js')).default;
  const Student = (await import('./models/Student.js')).default;
  const AcademicYear = (await import('./models/AcademicYear.js')).default;
  const Subject = (await import('./models/Subject.js')).default;
  const Curriculum = (await import('./models/Curriculum.js')).default;
  const ClassTeacherAllocation = (await import('./models/ClassTeacherAllocation.js')).default;
  const TeacherAllocation = (await import('./models/TeacherAllocation.js')).default;
  const Timetable = (await import('./models/Timetable.js')).default;
  const Exam = (await import('./models/Exam.js')).default;
  const ExamResult = (await import('./models/ExamResult.js')).default;

  const passwordHash = await bcrypt.hash('Demo@1234', 10);

  // admin-frontend's `isSuperAdmin` check (store.tsx) is hardcoded to this
  // exact email — without it, the ERP/Fees portal toggle never renders.
  const admin = await User.create({
    name: 'Demo Admin',
    email: 'devansh@gmail.com',
    passwordHash,
    role: 'ADMIN',
  });

  const teacher = await User.create({
    name: 'Rana Mitrajsinh (Demo)',
    contactNo1: '9499710732',
    passwordHash,
    role: 'TEACHER',
  });

  const parent = await Parent.create({
    parentName: 'Rana Mitrajsinh (Demo)',
    primaryMobileNumber: '9499710732',
    passwordHash,
  });

  const year = await AcademicYear.create({
    name: '2026-2027',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2027-04-30'),
    isActive: true,
  });

  const [maths, english, science] = await Subject.create([
    { subjectName: 'Mathematics', subjectCode: 'MAT' },
    { subjectName: 'English', subjectCode: 'ENG' },
    { subjectName: 'Science', subjectCode: 'SCI' },
  ]);
  const subjects = [maths, english, science];

  await Curriculum.create({
    academicYearId: year._id,
    standard: '1',
    medium: 'English',
    subjects: subjects.map((s) => s._id),
  });

  const student = await Student.create({
    studentName: 'Aarav Mitrajsinh (Demo)',
    studentCode: 'DEMO-STU-1',
    parentId: parent._id,
    medium: 'English',
    standard: '1',
    division: 'A',
    isActive: true,
    // ERP screens (Attendance/Results/ErpDashboard) only show students past
    // this migration-safety gate — see Student.js's isMigrated comment.
    isMigrated: true,
  });

  await ClassTeacherAllocation.create({
    academicYearId: year._id,
    teacherId: teacher._id,
    standard: '1',
    division: 'A',
    medium: 'English',
  });

  for (const subject of subjects) {
    await TeacherAllocation.create({
      academicYearId: year._id,
      teacherId: teacher._id,
      standard: '1',
      division: 'A',
      medium: 'English',
      subjectId: subject._id,
    });
  }

  // Three subjects, every weekday (Mon–Sat) — same three subjects each day.
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const periodTimes = [
    { name: 'Period 1', start: '08:00 AM', end: '08:45 AM', subject: maths },
    { name: 'Period 2', start: '08:45 AM', end: '09:30 AM', subject: english },
    { name: 'Period 3', start: '09:30 AM', end: '10:15 AM', subject: science },
  ];
  for (const day of days) {
    for (const p of periodTimes) {
      await Timetable.create({
        academicYearId: year._id,
        standard: '1',
        division: 'A',
        medium: 'English',
        dayOfWeek: day,
        periodName: p.name,
        startTime: p.start,
        endTime: p.end,
        subjectId: p.subject._id,
        teacherId: teacher._id,
      });
    }
  }

  // Two exams — a weekly test and a final — each with results for all 3 subjects.
  const weeklyTest = await Exam.create({
    academicYearId: year._id,
    standard: '1',
    divisions: ['A'],
    medium: 'English',
    examName: 'Weekly Test 1',
    type: 'MARKS',
    maxMarks: 50,
    passingMarks: 20,
    subjects: subjects.map((s) => ({ subjectId: s._id, examDate: new Date('2026-07-10') })),
    isPublished: true,
    createdBy: admin._id,
  });

  const finalExam = await Exam.create({
    academicYearId: year._id,
    standard: '1',
    divisions: ['A'],
    medium: 'English',
    examName: 'Final Examination',
    type: 'MARKS',
    maxMarks: 100,
    passingMarks: 35,
    subjects: subjects.map((s) => ({ subjectId: s._id, examDate: new Date('2026-11-20') })),
    isPublished: true,
    createdBy: admin._id,
  });

  const weeklyMarks = { [maths._id]: 42, [english._id]: 38, [science._id]: 45 };
  const finalMarks = { [maths._id]: 84, [english._id]: 76, [science._id]: 90 };

  for (const subject of subjects) {
    await ExamResult.create({
      examId: weeklyTest._id,
      studentId: student._id,
      subjectId: subject._id,
      marksObtained: weeklyMarks[subject._id],
      enteredBy: teacher._id,
    });
    await ExamResult.create({
      examId: finalExam._id,
      studentId: student._id,
      subjectId: subject._id,
      marksObtained: finalMarks[subject._id],
      enteredBy: teacher._id,
    });
  }

  console.log('Seeded ERP demo data:');
  console.log(`  Admin login    : devansh@gmail.com / Demo@1234 (super-admin — ERP toggle needs this exact email)`);
  console.log(`  Teacher login  : 9499710732 / Demo@1234 (mobile app, "Rana Mitrajsinh (Demo)")`);
  console.log(`  Parent login   : 9499710732 / Demo@1234 (same number — dual-role test case)`);
  console.log(`  Student        : Aarav Mitrajsinh (Demo), Std 1-A English`);
  console.log(`  Timetable      : Maths/English/Science, every Mon–Sat`);
  console.log(`  Exams          : "Weekly Test 1" (/50) and "Final Examination" (/100), both published with results\n`);

  const { default: app } = await import('./app.js');
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Demo backend listening on http://localhost:${PORT} (in-memory DB, safe to restart/kill)\n`);
  });
}

main().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
