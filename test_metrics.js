import mongoose from 'mongoose';
import DashboardService from './src/services/DashboardService.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const metrics = await DashboardService.getDailyMetrics('2026-07-02');
    console.log(metrics);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
});
