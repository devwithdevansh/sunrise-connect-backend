import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Using local URI since none is provided in .env
const uri = 'mongodb://localhost:27017/sunrise_connect';

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected.');

  // 1. Get all student IDs
  const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
  const students = await Student.find({}, '_id').lean();
  const studentIds = students.map(s => s._id);

  console.log(`Found ${studentIds.length} students.`);

  // 2. Query StudentFeeLedger
  const StudentFeeLedger = mongoose.model('StudentFeeLedger', new mongoose.Schema({}, { strict: false }));
  const orphanedLedgers = await StudentFeeLedger.find({ studentId: { $nin: studentIds } }).lean();

  // 3. Query Payment
  const Payment = mongoose.model('Payment', new mongoose.Schema({}, { strict: false }));
  const orphanedPayments = await Payment.find({ studentId: { $nin: studentIds } }).lean();

  console.log(`Found ${orphanedLedgers.length} orphaned ledgers and ${orphanedPayments.length} orphaned payments.`);

  let mdContent = `# Orphaned Records

These records reference a \`studentId\` that does not exist in the \`students\` collection.

## Orphaned Student Fee Ledgers (${orphanedLedgers.length})
`;

  if (orphanedLedgers.length > 0) {
    mdContent += `| _id | studentId | feePeriod | feeType | totalAmount | status |\n`;
    mdContent += `|---|---|---|---|---|---|\n`;
    orphanedLedgers.forEach(l => {
      mdContent += `| \`${l._id}\` | \`${l.studentId}\` | ${l.feePeriod} | ${l.feeType} | ₹${l.totalAmount} | ${l.status} |\n`;
    });
  } else {
    mdContent += `No orphaned ledgers found.\n`;
  }

  mdContent += `\n## Orphaned Payments (${orphanedPayments.length})\n`;
  if (orphanedPayments.length > 0) {
    mdContent += `| _id | studentId | parentId | amount | paymentMode | status |\n`;
    mdContent += `|---|---|---|---|---|---|\n`;
    orphanedPayments.forEach(p => {
      mdContent += `| \`${p._id}\` | \`${p.studentId}\` | \`${p.parentId}\` | ₹${p.amount} | ${p.paymentMode} | ${p.status} |\n`;
    });
  } else {
    mdContent += `No orphaned payments found.\n`;
  }

  mdContent += `\n## MongoDB Delete Queries

If you want to delete these orphaned records, you can run the following queries in your MongoDB shell (mongosh) or MongoDB Compass:

\`\`\`javascript
// 1. Get the list of all valid student IDs
const validStudentIds = db.students.find({}, { _id: 1 }).map(doc => doc._id);

// 2. Delete orphaned ledgers
db.studentfeeledgers.deleteMany({ studentId: { $nin: validStudentIds } });

// 3. Delete orphaned payments
db.payments.deleteMany({ studentId: { $nin: validStudentIds } });
\`\`\`
`;

  // Write to artifact
  const outPath = 'C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\73c15808-994a-4124-b554-87cefdccda3b\\orphaned_records.md';
  fs.writeFileSync(outPath, mdContent);
  console.log(`Written to ${outPath}`);

  await mongoose.disconnect();
}

run().catch(console.error);
