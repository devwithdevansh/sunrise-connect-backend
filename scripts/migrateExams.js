import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Exam from '../src/models/Exam.js';
import ExamResult from '../src/models/ExamResult.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const migrateExams = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const exams = await Exam.find({}).lean();
    console.log(`Found ${exams.length} exams to process.`);

    let migratedCount = 0;

    for (const exam of exams) {
      let needsMigration = false;

      // Check if this exam still has the old root fields
      const legacyType = exam.type || 'MARKS';
      const legacyMax = exam.maxMarks || 100;
      const legacyPass = exam.passingMarks || 35;

      // Map the legacy root fields into each subject
      exam.subjects.forEach((subject) => {
        if (!subject.gradingSystem) {
          subject.gradingSystem = legacyType === 'MARKS' ? 'Marks' : 'Grades';
          subject.maxMarks = legacyMax;
          subject.passingMarks = legacyPass;
          needsMigration = true;
        }
      });

      if (needsMigration) {
        // Use native MongoDB update to strip root fields and update subjects
        await Exam.collection.updateOne(
          { _id: exam._id },
          { 
             $set: { subjects: exam.subjects },
             $unset: { type: "", maxMarks: "", passingMarks: "" }
          }
        );
        migratedCount++;
        console.log(`Migrated Exam: ${exam.examName}`);
      }
    }

    console.log(`Migration complete. Successfully updated ${migratedCount} legacy exams.`);
    
    // Check if ExamResults need migration
    const results = await ExamResult.find({});
    let resultsMigrated = 0;

    for (const result of results) {
       if (!result.gradingSystem) {
          // Find parent exam
          const parentExam = exams.find(e => e._id.toString() === result.examId.toString());
          if (parentExam) {
             const subjectConfig = parentExam.subjects.find(s => s.subjectId.toString() === result.subjectId.toString());
             if (subjectConfig) {
                 result.gradingSystem = subjectConfig.gradingSystem;
                 result.maxMarks = subjectConfig.maxMarks;
                 result.passingMarks = subjectConfig.passingMarks;
                 await result.save();
                 resultsMigrated++;
             }
          }
       }
    }
    console.log(`Successfully migrated ${resultsMigrated} legacy exam results.`);

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrateExams();
