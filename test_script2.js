import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const student = await mongoose.connection.collection('students').findOne({ studentCode: 'STU1782819243827' });
  if (student) {
    const ledgers = await mongoose.connection.collection('studentfeeledgers').find({ studentId: student._id, feeType: 'TERM' }).toArray();
    console.log('TERM LEDGERS AARYAN:', ledgers.map(l => ({ feePeriod: l.feePeriod, amount: l.totalAmount, academicYear: l.academicYear })));
  }

  const studentUme = await mongoose.connection.collection('students').findOne({ studentName: /MALIK UME/ });
  if (studentUme) {
    const ledgers = await mongoose.connection.collection('studentfeeledgers').find({ studentId: studentUme._id, feeType: 'TERM' }).toArray();
    console.log('TERM LEDGERS UME:', ledgers.map(l => ({ feePeriod: l.feePeriod, amount: l.totalAmount, academicYear: l.academicYear })));
  }
  process.exit(0);
}
run().catch(console.error);
