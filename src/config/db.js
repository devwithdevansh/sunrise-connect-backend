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
import '../models/AcademicYear.js';
import '../models/Notification.js';

/**
 * Initialize MongoDB connection using Mongoose.
 * Returns a promise that resolves when the connection is established.
 */
const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('MongoDB connected');
    
    // Auto-sync indexes on startup to clean up any legacy global unique indexes
    // (e.g. dropping old "name" unique index that blocks multi-year categories)
    await mongoose.model('FeeCategory').syncIndexes();
    await mongoose.model('FeeStructure').syncIndexes();
    await mongoose.model('Notification').syncIndexes();
    logger.info('MongoDB indexes synchronized');
  } catch (err) {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

export default connectDB;
