// src/config/db.js
import mongoose from 'mongoose';
import env from './env.js';
import logger from './logger.js';

// Register all schemas with Mongoose to prevent MissingSchemaError on dynamic lookups
import '../models/User.js';
import '../models/Parent.js';
import '../models/Student.js';
import '../models/FeeCategory.js';
import '../models/FeeStructure.js';
import '../models/TransportFeeStructure.js';
import '../models/StudentFeeLedger.js';
import '../models/Payment.js';
import '../models/AuditLog.js';

/**
 * Initialize MongoDB connection using Mongoose.
 * Returns a promise that resolves when the connection is established.
 */
const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

export default connectDB;
