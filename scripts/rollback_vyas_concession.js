import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import StudentFeeLedger from '../src/models/StudentFeeLedger.js';
import Student from '../src/models/Student.js';
import AuditLog from '../src/models/AuditLog.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const student = await Student.findOne({ studentName: /VYAS PARAM/i }).lean();
  if (!student) throw new Error('Student not found');

  const ledgers = await StudentFeeLedger.find({ studentId: student._id }).lean();
  
  for (const l of ledgers) {
    if (['June', 'July', 'August', 'September', 'Term 1'].includes(l.feePeriod) && (l.feeType === 'EDUCATION' || l.feeType === 'TERM')) {
      if (l.status === 'PAID' && l.concessionAmount > 0) {
        const remaining = l.totalAmount - l.paidAmount; // rollback concession
        console.log(`Rolling back concession for ${l.feePeriod} (${l.feeType})`);
        
        await StudentFeeLedger.updateOne(
          { _id: l._id },
          { $set: { concessionAmount: 0, remainingAmount: remaining, status: 'PENDING' }, $inc: { __v: 1 } }
        );

        await AuditLog.create({
          targetLedgerId: l._id,
          targetStudentId: student._id,
          action: 'LEDGER_CONCESSION_ROLLED_BACK',
          details: { reason: 'Rolled back previous fix' }
        });
      }
    }
  }

  console.log('Done rolling back ledgers!');
  process.exit(0);
}

run().catch(console.error);
