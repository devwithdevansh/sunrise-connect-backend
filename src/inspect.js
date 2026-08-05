import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Student from './models/Student.js';
import StudentFeeLedger from './models/StudentFeeLedger.js';
import FeeCategory from './models/FeeCategory.js';
import Parent from './models/Parent.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('--- Students ---');
  console.log(JSON.stringify(await Student.find().lean(), null, 2));

  console.log('--- Ledgers ---');
  console.log(JSON.stringify(await StudentFeeLedger.find().lean(), null, 2));

  console.log('--- Fee Categories ---');
  console.log(JSON.stringify(await FeeCategory.find().lean(), null, 2));

  console.log('--- Parents ---');
  console.log(JSON.stringify(await Parent.find().lean(), null, 2));

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error inspecting DB:', err);
  process.exit(1);
});
