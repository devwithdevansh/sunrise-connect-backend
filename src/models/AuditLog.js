// src/models/AuditLog.js
// Stores business-state change events only (not auth/app events).

import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null, // null for system-initiated actions
    },
    targetParentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parent',
      default: null,
    },
    targetStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    targetLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentFeeLedger',
      default: null,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      enum: [
        'PARENT_CREATED',
        'PARENT_UPDATED',
        'PARENT_PASSWORD_SET',
        'PARENT_PASSWORD_RESET',
        'STUDENT_CREATED',
        'STUDENT_UPDATED',
        'STUDENT_DELETED',
        'LEDGER_CREATED',
        'LEDGER_PAYMENT_ADDED',
        'LEDGER_CONCESSION_APPLIED',
        'LEDGER_STATUS_UPDATED',
        'PAYMENT_CREATED',
        'PAYMENT_REVERSED',
        'MIGRATION_EXECUTED',
        'STAFF_CREATED',
        'STAFF_ACTIVATED',
        'STAFF_DEACTIVATED',
        'STAFF_PASSWORD_RESET',
        'STAFF_DELETED',
        'STUDENTS_PROMOTED',
        'STUDENT_TRANSPORT_UPDATED',
        'REFRESH_ROTATED', // kept for AuthService compatibility (frozen)
      ],
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes for fast admin lookups
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetParentId: 1, createdAt: -1 });
auditLogSchema.index({ targetLedgerId: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
