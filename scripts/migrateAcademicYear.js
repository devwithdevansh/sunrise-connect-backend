import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI');
  process.exit(1);
}

const OLD_YEAR = '2025-26';
const NEW_YEAR = '2025-2026';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Update AcademicYear
    const ayRes = await mongoose.connection.collection('academicyears').updateMany(
      { name: OLD_YEAR },
      { $set: { name: NEW_YEAR } }
    );
    console.log(`Updated ${ayRes.modifiedCount} AcademicYear records`);

    // 2. Update FeeStructure
    const fsRes = await mongoose.connection.collection('feestructures').updateMany(
      { academicYear: OLD_YEAR },
      { $set: { academicYear: NEW_YEAR } }
    );
    console.log(`Updated ${fsRes.modifiedCount} FeeStructure records`);

    // 3. Update StudentFeeLedger
    const ledRes = await mongoose.connection.collection('studentfeeledgers').updateMany(
      { academicYear: OLD_YEAR },
      { $set: { academicYear: NEW_YEAR } }
    );
    console.log(`Updated ${ledRes.modifiedCount} StudentFeeLedger records`);

    // 4. Update ledger snapshot (just in case)
    // Actually ledgers don't have academicYear inside snapshot, it's at the root.

    console.log('Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();
