import 'dotenv/config';
import mongoose from 'mongoose';
import Student from '../src/models/Student.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const students = await Student.find({}).select('studentName').lean();
  const problematic = students.filter(s =>
    /\s{2,}/.test(s.studentName) || s.studentName !== s.studentName.trim()
  );

  console.log(`Found ${problematic.length} student(s) with spacing issues:\n`);

  let fixed = 0, failed = 0;
  for (const s of problematic) {
    const cleanName = s.studentName.trim().replace(/\s+/g, ' ');
    console.log(`  [${s._id}] "${s.studentName}" -> "${cleanName}"`);
    try {
      await Student.updateOne({ _id: s._id }, { $set: { studentName: cleanName } });
      console.log('  ✅ Fixed');
      fixed++;
    } catch (e) {
      console.error('  ❌ Failed:', e.message);
      failed++;
    }
  }

  console.log(`\nDone. ✅ ${fixed} fixed  ✗ ${failed} failed`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
