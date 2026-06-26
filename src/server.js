import mongoose from 'mongoose';
import app from './app.js';
import env from './config/env.js';
import logger from './config/logger.js';
import connectDB from './config/db.js';

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  process.exit(1);
});

// Connect to Database
connectDB();

const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
