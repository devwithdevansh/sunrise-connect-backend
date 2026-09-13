import 'dotenv/config';
import mongoose from 'mongoose';
import Student from '../src/models/Student.js';

const ledgerSchema = new mongoose.Schema({ studentId: mongoose.Schema.Types.ObjectId, feeType: String, status: String, paidAmount: Number, totalAmount: Number, academicYear: String, feePeriod: String }, { strict: false });
const paymentSchema = new mongoose.Schema({ ledgerId: mongoose.Schema.Types.ObjectId, amount: Number, paymentDate: String, receiptNumber: String }, { strict: false });

const Ledger = mongoose.model('StudentFeeLedger', ledgerSchema);
const Payment = mongoose.model('Payment', paymentSchema);

const IDS = {
  'OLD (double-space)': '6a51e016bb37a60d549f3298',
  'NEW (single-space)': '6a6c3a1329038e32643a6f00',
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected\n');

  // Also fetch the student docs to compare all fields
  const students = await Student.find({ _id: { $in: Object.values(IDS) } }).lean();
  for (const s of students) {
    const label = Object.entries(IDS).find(([, v]) => v === s._id.toString())?.[0];
    console.log(`=== Student: ${label} ===`);
    console.log(`  Name      : "${s.studentName}"`);
    console.log(`  Standard  : ${s.standard}`);
    console.log(`  Division  : ${s.division}`);
    console.log(`  Medium    : ${s.medium}`);
    console.log(`  RTE       : ${s.isRTE}`);
    console.log(`  Transport : ${s.transportType}`);
    console.log(`  Active    : ${s.isActive}`);
    console.log(`  Created   : ${s.createdAt}`);

    const ledgers = await Ledger.find({ studentId: s._id }).lean();
    const ledgerIds = ledgers.map(l => l._id);
    const payments = await Payment.find({ ledgerId: { $in: ledgerIds } }).lean();
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const paidLedgers = ledgers.filter(l => l.status === 'PAID' || (l.paidAmount && l.paidAmount > 0));

    console.log(`  Ledgers   : ${ledgers.length}`);
    console.log(`  Paid Ledgers: ${paidLedgers.length}`);
    console.log(`  Payments  : ${payments.length} (Total: ₹${totalPaid})`);
    if (payments.length > 0) {
      payments.forEach(p => console.log(`    → Receipt ${p.receiptNumber} | ₹${p.amount} | ${p.paymentDate}`));
    }
    console.log('');
  }

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
