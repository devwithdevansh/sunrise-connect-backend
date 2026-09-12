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
import Parent from '../src/models/Parent.js';

// Configuration
const TEST_PHONE = '9499710732'; // Must match the user request
const TEACHER_NAME = 'Rana Mtrajsinh';
const SUBJECT_NAME = 'Mathematics';
const SUBJECT_CODE = 'MAT';
const STANDARD = '10';
const DIVISION = 'A';
const MEDIUM = 'English';

async function main() {
  console.log('Seeding Test Teacher Data...');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // 1. Get or create Academic Year
  let academicYear = await AcademicYear.findOne({ name: '2026-2027' });
  if (!academicYear) {
    academicYear = await AcademicYear.create({
      name: '2026-2027',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      status: 'ACTIVE',
    });
    console.log('✅ Created dummy Academic Year');
  } else {
    console.log('✅ Found active Academic Year');
  }

  // 2. Fetch the Parent's password to match for the Teacher
  const parent = await Parent.findOne({ primaryMobileNumber: TEST_PHONE }).select('+passwordHash');
  if (!parent) {
    throw new Error(`Parent with phone ${TEST_PHONE} not found! Cannot sync password.`);
  }
  const passwordHash = parent.passwordHash;

  // 3. Create or update the Teacher User
  let teacher = await User.findOne({ contactNo1: TEST_PHONE, role: 'TEACHER' });
  if (!teacher) {
    teacher = await User.create({
      name: TEACHER_NAME,
      contactNo1: TEST_PHONE,
      passwordHash: passwordHash,
      role: 'TEACHER',
      isActive: true,
      teacherProfile: {
        isClassTeacherFor: {
          standard: STANDARD,
          division: DIVISION,
          medium: MEDIUM
        },
        subjectsAssigned: [
          {
            subjectName: SUBJECT_NAME,
            standard: STANDARD,
            division: DIVISION,
            medium: MEDIUM
          }
        ]
      }
    });
    console.log(`✅ Created Teacher: ${TEACHER_NAME} (${TEST_PHONE})`);
  } else {
    await User.updateOne({ _id: teacher._id }, { 
      $set: { 
        passwordHash, 
        name: TEACHER_NAME,
        teacherProfile: {
          isClassTeacherFor: {
            standard: STANDARD,
            division: DIVISION,
            medium: MEDIUM
          },
          subjectsAssigned: [
            {
              subjectName: SUBJECT_NAME,
              standard: STANDARD,
              division: DIVISION,
              medium: MEDIUM
            }
          ]
        }
      } 
    });
    console.log(`✅ Updated existing Teacher: ${TEACHER_NAME} (${TEST_PHONE})`);
  }

  // 4. Create Subject
  let subject = await Subject.findOne({ subjectCode: SUBJECT_CODE });
  if (!subject) {
    subject = await Subject.create({
      subjectName: SUBJECT_NAME,
      subjectCode: SUBJECT_CODE,
      type: 'Theory',
      gradingSystem: 'Marks'
    });
    console.log(`✅ Created Subject: ${SUBJECT_NAME}`);
  } else {
    console.log(`✅ Found existing Subject: ${SUBJECT_NAME}`);
  }

  // 5. Create Curriculum
  let curriculum = await Curriculum.findOne({
    academicYearId: academicYear._id,
    standard: STANDARD,
    medium: MEDIUM
  });
  if (!curriculum) {
    curriculum = await Curriculum.create({
      academicYearId: academicYear._id,
      standard: STANDARD,
      medium: MEDIUM,
      subjects: [subject._id]
    });
    console.log(`✅ Created Curriculum for ${STANDARD} (${MEDIUM})`);
  } else {
    if (!curriculum.subjects.includes(subject._id)) {
      curriculum.subjects.push(subject._id);
      await curriculum.save();
    }
    console.log(`✅ Updated Curriculum for ${STANDARD} (${MEDIUM})`);
  }

  // 6. Class Teacher Allocation
  let classTeacherAlloc = await ClassTeacherAllocation.findOne({
    academicYearId: academicYear._id,
    standard: STANDARD,
    division: DIVISION,
    medium: MEDIUM
  });
  if (!classTeacherAlloc) {
    await ClassTeacherAllocation.create({
      academicYearId: academicYear._id,
      teacherId: teacher._id,
      standard: STANDARD,
      division: DIVISION,
      medium: MEDIUM
    });
    console.log(`✅ Allocated as Class Teacher for ${STANDARD}-${DIVISION}`);
  } else {
    classTeacherAlloc.teacherId = teacher._id;
    await classTeacherAlloc.save();
    console.log(`✅ Updated Class Teacher Allocation for ${STANDARD}-${DIVISION}`);
  }

  // 7. Subject Teacher Allocation
  let subjectAlloc = await TeacherAllocation.findOne({
    academicYearId: academicYear._id,
    standard: STANDARD,
    division: DIVISION,
    medium: MEDIUM,
    subjectId: subject._id
  });
  if (!subjectAlloc) {
    await TeacherAllocation.create({
      academicYearId: academicYear._id,
      teacherId: teacher._id,
      standard: STANDARD,
      division: DIVISION,
      medium: MEDIUM,
      subjectId: subject._id
    });
    console.log(`✅ Allocated to teach ${SUBJECT_NAME} in ${STANDARD}-${DIVISION}`);
  } else {
    subjectAlloc.teacherId = teacher._id;
    await subjectAlloc.save();
    console.log(`✅ Updated Subject Allocation for ${SUBJECT_NAME} in ${STANDARD}-${DIVISION}`);
  }

  // 8. Timetable
  let timetable = await Timetable.findOne({
    academicYearId: academicYear._id,
    standard: STANDARD,
    division: DIVISION,
    medium: MEDIUM,
    dayOfWeek: 'Monday',
    periodName: 'Period 1'
  });
  if (!timetable) {
    await Timetable.create({
      academicYearId: academicYear._id,
      standard: STANDARD,
      division: DIVISION,
      medium: MEDIUM,
      dayOfWeek: 'Monday',
      periodName: 'Period 1',
      startTime: '08:00 AM',
      endTime: '08:45 AM',
      subjectId: subject._id,
      teacherId: teacher._id
    });
    console.log(`✅ Created Timetable entry: Monday Period 1 for ${SUBJECT_NAME}`);
  } else {
    timetable.subjectId = subject._id;
    timetable.teacherId = teacher._id;
    await timetable.save();
    console.log(`✅ Updated Timetable entry: Monday Period 1 for ${SUBJECT_NAME}`);
  }

  console.log('\n🎉 Test Data Seeding Complete!');
  console.log('You can now log in using the mobile number and parent password to test dual roles.');
  
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
