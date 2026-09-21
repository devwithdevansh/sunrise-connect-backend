import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import Student from '../src/models/Student.js';
import FeeLedger from '../src/models/StudentFeeLedger.js';
import Receipt from '../src/models/Payment.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  let student = await Student.findOne({ studentId: 'STU1783667778675' }).lean();
  if (!student) {
    console.log('Student not found by ID. Searching by name...');
    student = await Student.findOne({ studentName: /VYAS PARAM/i }).lean();
    if (!student) {
      console.log('Not found by name either');
      process.exit(1);
    }
    console.log('Found student:', student.studentName, student.studentId);
  } else {
    console.log('Found student:', student.studentName, student.studentId);
  }

  const ledgers = await FeeLedger.find({ studentId: student._id }).lean();
  console.log('\n--- Fee Ledgers ---');
  for (const l of ledgers) {
    if (['June', 'July', 'August', 'September', 'Term 1'].includes(l.feePeriod)) {
      console.log(`Type: ${l.feeType}, Period: ${l.feePeriod}, Status: ${l.status}, Paid: ${l.paidAmount}, Concession: ${l.concessionAmount}`);
    }
  }

  const receipts = await Receipt.find({ studentId: student._id }).lean();
  console.log('\n--- Receipts ---');
  for (const r of receipts) {
    console.log(JSON.stringify(r, null, 2));
  }

  process.exit(0);
}
run().catch(console.error);
