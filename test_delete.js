import mongoose from 'mongoose';
import StudentService from './src/services/StudentService.js';
import env from './src/config/env.js';
import './src/models/StudentFeeLedger.js';
import './src/models/Student.js';

async function test() {
  await mongoose.connect(env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const student = await mongoose.model('Student').findOne().sort({ createdAt: -1 });
  if (!student) {
    console.log('No student');
    process.exit(0);
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await StudentService._deactivateStudent(student._id, session);
    await session.commitTransaction();
    console.log('Success');
  } catch (e) {
    console.error('Error during deactivate:', e);
    await session.abortTransaction();
  } finally {
    session.endSession();
    process.exit(0);
  }
}
test();
