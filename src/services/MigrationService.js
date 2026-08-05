// src/services/MigrationService.js
// Handles bulk migration of legacy data into the current schema.
// Single MIGRATION_EXECUTED audit entry per operation.

import mongoose from 'mongoose';
import parentRepository from '../repositories/parentRepository.js';
import studentRepository from '../repositories/studentRepository.js';
import AuditService from './AuditService.js';
import logger from '../config/logger.js';

class MigrationService {
  /** Bulk insert parents */
  static async migrateParents(parents) {
    if (!Array.isArray(parents) || parents.length === 0) throw new Error('parents must be a non-empty array');
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await parentRepository.insertMany(parents, { session, ordered: false });
      await AuditService.log(
        { performedBy: null, targetParentId: null, action: 'MIGRATION_EXECUTED', details: { type: 'parents', count: parents.length } },
        session
      );
      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      logger.error('MigrationService.migrateParents error', e);
      throw e;
    } finally {
      session.endSession();
    }
  }

  /** Bulk insert students */
  static async migrateStudents(students) {
    if (!Array.isArray(students) || students.length === 0) throw new Error('students must be a non-empty array');
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await studentRepository.insertMany(students, { session, ordered: false });
      await AuditService.log(
        { performedBy: null, targetStudentId: null, action: 'MIGRATION_EXECUTED', details: { type: 'students', count: students.length } },
        session
      );
      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      logger.error('MigrationService.migrateStudents error', e);
      throw e;
    } finally {
      session.endSession();
    }
  }
}

export default MigrationService;
