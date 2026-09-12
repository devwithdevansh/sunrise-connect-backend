import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import AcademicYear from '../src/models/AcademicYear.js';
import Subject from '../src/models/Subject.js';
import TeacherAllocation from '../src/models/TeacherAllocation.js';
import ClassTeacherAllocation from '../src/models/ClassTeacherAllocation.js';

dotenv.config({ path: '.env' });

const runMigration = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const activeYear = await AcademicYear.findOne({ isActive: true });
    if (!activeYear) {
      console.log('No active academic year found. Cannot migrate.');
      process.exit(1);
    }

    const teachers = await User.find({ role: 'TEACHER' });
    console.log(`Found ${teachers.length} teachers to migrate.`);

    let subjectCreated = 0;
    let subjectSkippedDup = 0;
    let subjectSkippedNoMatch = 0;
    let classTeacherCreated = 0;
    let classTeacherSkippedDup = 0;

    for (const teacher of teachers) {
      // 1. Migrate subjectsAssigned
      const subjectsAssigned = teacher.teacherProfile?.subjectsAssigned || [];
      for (const sub of subjectsAssigned) {
        // sub.subjectName, sub.standard, sub.division, sub.medium
        const subjectDoc = await Subject.findOne({ subjectName: new RegExp(`^${sub.subjectName}$`, 'i') });
        
        if (!subjectDoc) {
          console.log(`[WARN] Subject match not found for '${sub.subjectName}' (Teacher: ${teacher.name}). Skipped.`);
          subjectSkippedNoMatch++;
          continue;
        }

        try {
          await TeacherAllocation.create({
            academicYearId: activeYear._id,
            teacherId: teacher._id,
            standard: sub.standard,
            division: sub.division,
            medium: sub.medium,
            subjectId: subjectDoc._id
          });
          subjectCreated++;
        } catch (err) {
          if (err.code === 11000) {
            subjectSkippedDup++;
          } else {
            console.error(err);
          }
        }
      }

      // 2. Migrate isClassTeacherFor
      const classTeacher = teacher.teacherProfile?.isClassTeacherFor;
      if (classTeacher && classTeacher.standard) {
        try {
          await ClassTeacherAllocation.create({
            academicYearId: activeYear._id,
            teacherId: teacher._id,
            standard: classTeacher.standard,
            division: classTeacher.division,
            medium: classTeacher.medium
          });
          classTeacherCreated++;
        } catch (err) {
          if (err.code === 11000) {
            classTeacherSkippedDup++;
          } else {
            console.error(err);
          }
        }
      }
    }

    console.log('\n--- Migration Summary ---');
    console.log(`Teacher Allocations Created: ${subjectCreated}`);
    console.log(`Teacher Allocations Skipped (Duplicate): ${subjectSkippedDup}`);
    console.log(`Teacher Allocations Skipped (No Subject Match): ${subjectSkippedNoMatch}`);
    console.log(`Class Teacher Allocations Created: ${classTeacherCreated}`);
    console.log(`Class Teacher Allocations Skipped (Duplicate): ${classTeacherSkippedDup}`);

    console.log('\nMigration complete.');
    process.exit(0);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

runMigration();
