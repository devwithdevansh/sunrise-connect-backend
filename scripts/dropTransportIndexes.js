import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function dropOldIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected');
    const col = mongoose.connection.collection('transportfeestructures');
    const indexes = await col.indexes();
    console.log('Existing indexes:', indexes.map(i => i.name));
    // Drop all non-_id indexes so Mongoose can recreate the correct ones
    for (const idx of indexes) {
      if (idx.name !== '_id_') {
        await col.dropIndex(idx.name);
        console.log(`Dropped: ${idx.name}`);
      }
    }
    console.log('Done. Mongoose will recreate correct indexes on next connection.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
dropOldIndex();
