import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FeeCategory from '../src/models/FeeCategory.js';

dotenv.config();

const migrate = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sunrise_connect';
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    console.log('Finding Bag & Kit categories with type OTHER...');
    const result = await FeeCategory.updateMany(
      { type: 'OTHER', name: 'Bag & Kit' },
      { $set: { type: 'BAG_KIT' } }
    );

    console.log(`Migration complete. Modified ${result.modifiedCount} documents.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
};

migrate();
