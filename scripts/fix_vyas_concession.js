import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import StudentFeeLedger from '../src/models/StudentFeeLedger.js';
import Student from '../src/models/Student.js';
import LedgerService from '../src/services/LedgerService.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const student = await Student.findOne({ studentName: /VYAS PARAM/i }).lean();
  if (!student) throw new Error('Student not found');

  const ledgers = await StudentFeeLedger.find({ studentId: student._id }).lean();
  
  for (const l of ledgers) {
    if (['June', 'July', 'August', 'September', 'Term 1'].includes(l.feePeriod) && (l.feeType === 'EDUCATION' || l.feeType === 'TERM')) {
      if (l.status !== 'PAID') {
        const remaining = l.totalAmount - l.paidAmount - l.concessionAmount;
        if (remaining > 0) {
          console.log(`Applying concession of ${remaining} to ${l.feePeriod} (${l.feeType})`);
          await LedgerService.applyConcession({
            ledgerId: l._id,
            amount: remaining,
            reason: 'Migration fix: Full concession applied retrospectively'
          });
        }
      }
    }
  }

  console.log('Done fixing ledgers!');
  process.exit(0);
}

run().catch(console.error);
