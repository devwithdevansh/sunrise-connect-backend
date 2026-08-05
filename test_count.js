import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const count = await mongoose.connection.collection('studentfeeledgers').countDocuments();
  console.log('Total ledgers in DB:', count);
  process.exit(0);
}
run().catch(console.error);
