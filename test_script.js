import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const student = await mongoose.connection.collection('students').findOne({ studentCode: 'STU1782802682751' });
  if (!student) {
    console.log('Student not found');
    process.exit(1);
  }
  
  const ledgers = await mongoose.connection.collection('studentfeeledgers').find({ studentId: student._id, feeType: 'TERM' }).toArray();
  console.log('TERM LEDGERS:');
  console.log(JSON.stringify(ledgers, null, 2));

  const allLedgers = await mongoose.connection.collection('studentfeeledgers').find({ studentId: student._id }).toArray();
  console.log('\nALL LEDGER TYPES:');
  console.log([...new Set(allLedgers.map(l => l.feeType))]);

  process.exit(0);
}
run().catch(console.error);
