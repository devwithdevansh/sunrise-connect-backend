import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Student from '../src/models/Student.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const mitraj = await Student.findOne({ studentName: /mitraj/i });
  console.log(mitraj);
  
  if (mitraj) {
    try {
      mitraj.isMigrated = true;
      await mitraj.save();
      console.log('Saved successfully');
    } catch(e) {
      console.log('Validation Error:', e.message);
    }
  }
  process.exit();
}

run();
