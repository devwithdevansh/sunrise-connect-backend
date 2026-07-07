import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const years = await mongoose.connection.collection('academicyears').find().toArray();
  console.log('YEARS:', years);
  process.exit(0);
}
run().catch(console.error);
