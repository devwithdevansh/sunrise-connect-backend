import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import User from '../src/models/User.js';
import Subject from '../src/models/Subject.js';
import Curriculum from '../src/models/Curriculum.js';
import ClassTeacherAllocation from '../src/models/ClassTeacherAllocation.js';
import TeacherAllocation from '../src/models/TeacherAllocation.js';
import Timetable from '../src/models/Timetable.js';
import AcademicYear from '../src/models/AcademicYear.js';

const DEFAULT_PASSWORD = 'password123';

const TEACHERS = [
  {
    name: 'Teacher A (Class Teacher)',
    email: 'teacher.a@test.com',
    phone: '9999999991',
    role: 'TEACHER',
    profile: {
      isClassTeacherFor: { standard: '10', division: 'A', medium: 'English' },
      subjectsAssigned: [
        { subjectName: 'Mathematics', standard: '10', division: 'A', medium: 'English' },
        { subjectName: 'Mathematics', standard: '10', division: 'B', medium: 'English' },
      ]
    }
  },
  {
    name: 'Teacher B (Subject Teacher)',
    email: 'teacher.b@test.com',
    phone: '9999999992',
    role: 'TEACHER',
    profile: {
      isClassTeacherFor: null,
      subjectsAssigned: [
        { subjectName: 'Science', standard: '10', division: 'A', medium: 'English' },
        { subjectName: 'Science', standard: '9', division: 'A', medium: 'English' },
      ]
    }
  },
  {
    name: 'Teacher C (New Hire)',
    email: 'teacher.c@test.com',
    phone: '9999999993',
    role: 'TEACHER',
    profile: {
      isClassTeacherFor: null,
      subjectsAssigned: []
    }
  }
];

const SUBJECTS = [
  { name: 'Mathematics', code: 'MAT' },
  { name: 'Science', code: 'SCI' },
  { name: 'English', code: 'ENG' }
];

async function main() {
  console.log('Seeding Full Demo Data...\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // 1. Academic Year
  let activeYear = await AcademicYear.findOne({ isActive: true });
  if (!activeYear) {
    activeYear = await AcademicYear.findOne({ name: '2026-2027' });
    if (!activeYear) {
      activeYear = await AcademicYear.create({
        name: '2026-2027',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-05-31'),
        status: 'ACTIVE',
        isActive: true,
      });
    }
  }
  const yearId = activeYear._id;
  console.log(`✅ Using Academic Year: ${activeYear.name}`);

  // 2. Hash default password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, salt);

  // 3. Create Subjects
  const subjectMap = {};
  for (const s of SUBJECTS) {
    let sub = await Subject.findOne({ subjectCode: s.code });
    if (!sub) {
      sub = await Subject.create({
        subjectName: s.name,
        subjectCode: s.code,
        type: 'Theory',
        gradingSystem: 'Marks'
      });
    }
    subjectMap[s.name] = sub._id;
  }
  console.log('✅ Ensured Demo Subjects exist');

  // 4. Create Curriculums
  const curClasses = [
    { std: '10', med: 'English' },
    { std: '9', med: 'English' }
  ];
  for (const cls of curClasses) {
    let cur = await Curriculum.findOne({ academicYearId: yearId, standard: cls.std, medium: cls.med });
    if (!cur) {
      cur = await Curriculum.create({
        academicYearId: yearId,
        standard: cls.std,
        medium: cls.med,
        subjects: Object.values(subjectMap)
      });
    } else {
      cur.subjects = Object.values(subjectMap);
      await cur.save();
    }
  }
  console.log('✅ Configured Curriculums for 9 and 10');

  // 5. Create Teachers & Allocations
  const teacherMap = {};
  for (const t of TEACHERS) {
    let user = await User.findOne({ contactNo1: t.phone });
    if (!user) {
      user = await User.create({
        name: t.name,
        email: t.email,
        contactNo1: t.phone,
        passwordHash,
        role: t.role,
        isActive: true,
        teacherProfile: t.profile
      });
    } else {
      user.name = t.name;
      user.email = t.email;
      user.passwordHash = passwordHash;
      user.teacherProfile = t.profile;
      await user.save();
    }
    teacherMap[t.name] = user._id;

    // Clean existing allocations for this teacher
    await ClassTeacherAllocation.deleteMany({ teacherId: user._id, academicYearId: yearId });
    await TeacherAllocation.deleteMany({ teacherId: user._id, academicYearId: yearId });

    // Recreate allocations
    if (t.profile.isClassTeacherFor) {
      await ClassTeacherAllocation.findOneAndUpdate(
        {
          academicYearId: yearId,
          standard: t.profile.isClassTeacherFor.standard,
          division: t.profile.isClassTeacherFor.division,
          medium: t.profile.isClassTeacherFor.medium
        },
        { teacherId: user._id },
        { upsert: true }
      );
    }

    for (const alloc of t.profile.subjectsAssigned) {
      await TeacherAllocation.findOneAndUpdate(
        {
          academicYearId: yearId,
          subjectId: subjectMap[alloc.subjectName],
          standard: alloc.standard,
          division: alloc.division,
          medium: alloc.medium
        },
        { teacherId: user._id },
        { upsert: true }
      );
    }
  }
  console.log('✅ Generated Demo Teachers & Allocations');

  // 6. Generate Dummy Timetable for 10-A
  await Timetable.deleteMany({ academicYearId: yearId, standard: '10', division: 'A', medium: 'English' });
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = [
    { name: 'Period 1', start: '08:00 AM', end: '08:45 AM' },
    { name: 'Period 2', start: '08:45 AM', end: '09:30 AM' },
    { name: 'Break', start: '09:30 AM', end: '09:45 AM' },
    { name: 'Period 3', start: '09:45 AM', end: '10:30 AM' },
  ];

  for (const day of days) {
    for (const p of periods) {
      if (p.name === 'Break') continue;
      
      // Determine subject/teacher
      let subName = 'English';
      let tId = null;

      if (p.name === 'Period 1') {
        subName = 'Mathematics';
        tId = teacherMap['Teacher A (Class Teacher)'];
      } else if (p.name === 'Period 2') {
        subName = 'Science';
        tId = teacherMap['Teacher B (Subject Teacher)'];
      }

      await Timetable.create({
        academicYearId: yearId,
        standard: '10',
        division: 'A',
        medium: 'English',
        dayOfWeek: day,
        periodName: p.name,
        startTime: p.start,
        endTime: p.end,
        subjectId: subjectMap[subName],
        teacherId: tId
      });
    }
  }
  console.log('✅ Generated Full Timetable for 10-A (English)');

  console.log('\n🎉 Demo Data Seeding Complete!');
  console.log('Test Credentials:');
  TEACHERS.forEach(t => {
    console.log(`- ${t.name}: Phone: ${t.phone}, Password: ${DEFAULT_PASSWORD}`);
  });

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
