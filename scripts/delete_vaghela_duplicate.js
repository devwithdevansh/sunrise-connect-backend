import 'dotenv/config';
import mongoose from 'mongoose';
import Student from '../src/models/Student.js';

const ledgerSchema = new mongoose.Schema({ studentId: mongoose.Schema.Types.ObjectId }, { strict: false });
const Ledger = mongoose.model('StudentFeeLedger', ledgerSchema);

const OLD_ID = '6a51e016bb37a60d549f3298'; // VAGHELA  ANSH (double-space, Jul 11)

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected\n');

  // Safety check: confirm no payments exist
  const ledgers = await Ledger.find({ studentId: OLD_ID }).lean();
  const Payment = mongoose.model('Payment', new mongoose.Schema({ ledgerId: mongoose.Schema.Types.ObjectId, amount: Number }, { strict: false }));
  const ledgerIds = ledgers.map(l => l._id);
  const payments = await Payment.find({ ledgerId: { $in: ledgerIds } }).lean();

  if (payments.length > 0) {
    console.error('❌ ABORTED: Found payments on this record! Cannot safely delete.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('✅ Confirmed: 0 payments on OLD record. Safe to delete.\n');

  // Delete ledgers first
  const ledgerDel = await Ledger.deleteMany({ studentId: OLD_ID });
  console.log(`Deleted ${ledgerDel.deletedCount} ledger(s) for OLD student.`);

  // Delete the student
  const studentDel = await Student.deleteOne({ _id: OLD_ID });
  console.log(`Deleted ${studentDel.deletedCount} student record (VAGHELA  ANSH - double space).`);

  console.log('\n✅ Done. VAGHELA ANSH (single-space, Jul 31) is now the only record.');
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
