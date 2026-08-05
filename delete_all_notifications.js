import mongoose from 'mongoose';
import env from './src/config/env.js';
import Notification from './src/models/Notification.js';

async function deleteAllNotifications() {
  try {
    console.log(`Connecting to MongoDB at: ${env.MONGODB_URI}`);
    await mongoose.connect(env.MONGODB_URI);
    console.log('Successfully connected to MongoDB.');

    console.log('Deleting all notifications...');
    const result = await Notification.deleteMany({});
    
    console.log(`✅ Success! Deleted ${result.deletedCount} notifications from the database.`);
    
    // Disconnect
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting notifications:', error);
    process.exit(1);
  }
}

deleteAllNotifications();
