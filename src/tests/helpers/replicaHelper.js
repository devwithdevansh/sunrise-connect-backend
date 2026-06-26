// src/tests/helpers/replicaHelper.js
// Replica-set helper for service tests that require MongoDB transactions.
// MongoMemoryReplSet is used because sessions require a replica set.

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Import all models so they are registered in mongoose.connection.models
import '../../models/Parent.js';
import '../../models/Student.js';
import '../../models/StudentFeeLedger.js';
import '../../models/Payment.js';
import '../../models/AuditLog.js';
import '../../models/User.js';

let replSet;

export async function connectReplica() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  // Step 1: Create all collections explicitly so they exist before any transaction.
  // Transactions cannot create collections – they must already exist.
  await Promise.all(
    Object.values(mongoose.connection.models).map(m => m.createCollection())
  );

  // Step 2: Build all indexes synchronously.
  // Without this, Mongoose may kick off background index builds that hold
  // DDL locks, causing IX-lock timeout errors in subsequent transactions.
  await Promise.all(
    Object.values(mongoose.connection.models).map(m => m.syncIndexes())
  );
}

export async function disconnectReplica() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await replSet.stop();
}

export async function clearCollections() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
