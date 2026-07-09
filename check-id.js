import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sunrise';
const id = '6a4e84cddf936b62b039423d';

async function check() {
  try {
    await mongoose.connect(uri);
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const c of collections) {
      const doc = await mongoose.connection.db.collection(c.name).findOne({ _id: new mongoose.Types.ObjectId(id) });
      if (doc) {
        console.log('Found in', c.name, ':', JSON.stringify(doc, null, 2));
        process.exit(0);
      }
    }
    console.log('Not found anywhere');
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
check();
