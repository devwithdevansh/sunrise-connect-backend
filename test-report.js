import mongoose from 'mongoose';
import env from './src/config/env.js';
import ReportService from './src/services/ReportService.js';

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to DB');
  try {
    const report = await ReportService.getUnpaidReport();
    console.log('Report generated successfully, length:', report.length);
  } catch (e) {
    console.error('Error in getUnpaidReport:', e);
  }
  mongoose.disconnect();
}
run();
