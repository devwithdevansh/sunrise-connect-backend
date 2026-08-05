import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const student = await mongoose.connection.collection('students').findOne({ studentCode: 'STU1782802682751' });
  const ledgersP = await mongoose.connection.collection('studentfeeledgers').find({ studentId: student._id, feeType: 'TERM' }).toArray();
  console.log('PRAYAG:', ledgersP.map(l => l.dueDate));

  const studentUme = await mongoose.connection.collection('students').findOne({ studentName: /MALIK UME/ });
  const ledgersU = await mongoose.connection.collection('studentfeeledgers').find({ studentId: studentUme._id, feeType: 'TERM' }).toArray();
  console.log('UME:', ledgersU.map(l => l.dueDate));
  process.exit(0);
}
run().catch(console.error);
