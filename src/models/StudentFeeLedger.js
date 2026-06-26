import mongoose from 'mongoose';

// Snapshot Schema (Denormalized data for fast reporting)
const snapshotSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true },
    medium: { type: String, required: true },
    standard: { type: String, required: true },
    division: { type: String, required: true },
    transportType: { type: String, required: true },
    isRTE: { type: Boolean, required: true },
  },
  { _id: false } // No need for an internal object ID for the snapshot
);

// Main Ledger Schema
const studentFeeLedgerSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student ID is required'],
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required (e.g., "2025-26")'],
      trim: true,
    },
    feeCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeCategory',
      required: [true, 'Fee Category ID is required'],
    },
    feePeriod: {
      type: String,
      required: [true, 'Fee period is required (e.g., "June" or "Term 1")'],
      trim: true,
    },
    feeType: {
      type: String,
      required: [true, 'Fee type is required'],
      enum: {
        values: ['EDUCATION', 'TERM', 'TRANSPORT', 'ADMISSION', 'OTHER', 'BAG_KIT'],
        message: '{VALUE} is not a valid fee type',
      },
    },
    ledgerNumber: {
      type: String,
      required: [true, 'Ledger number is required'],
      unique: true, // Automatically creates an index for exact ledger lookups
      trim: true,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative'],
    },
    concessionAmount: {
      type: Number,
      default: 0,
      min: [0, 'Concession amount cannot be negative'],
    },
    remainingAmount: {
      type: Number,
      required: [true, 'Remaining amount is required'],
      min: [0, 'Remaining amount cannot be negative'],
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: ['PENDING', 'PARTIAL', 'PAID', 'WAIVED', 'CANCELLED'],
        message: '{VALUE} is not a valid status',
      },
      default: 'PENDING',
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    source: {
      type: String,
      required: [true, 'Source is required'],
      enum: {
        values: ['GENERATED', 'MIGRATED', 'MANUAL'],
        message: '{VALUE} is not a valid source',
      },
    },
    generatedFrom: {
      type: String,
      required: [true, 'Generated from is required'],
      enum: {
        values: ['FEE_STRUCTURE', 'TRANSPORT_STRUCTURE', 'MIGRATION'],
        message: '{VALUE} is not a valid generatedFrom value',
      },
    },
    remarks: {
      type: String,
      trim: true,
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    snapshot: {
      type: snapshotSchema,
      required: [true, 'Student snapshot is required'],
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// ==========================================
// INDEXING STRATEGY (CRITICAL FOR PERFORMANCE)
// ==========================================

// 1. Unique Ledger Generation Guard
// Prevents accidentally generating the exact same fee for a student twice.
studentFeeLedgerSchema.index({ studentId: 1, feeCategoryId: 1, feePeriod: 1, academicYear: 1 }, { unique: true });

// 2. Parent App Lookups (Academic Year First)
// When parent logs in, fetches their child's fees for the current active year quickly.
studentFeeLedgerSchema.index({ academicYear: 1, studentId: 1, status: 1 });

// 3. Global Due Reports & Dashboard (Academic Year First)
// Instantly calculates total pending revenue for the whole school for a specific year.
studentFeeLedgerSchema.index({ academicYear: 1, status: 1 });

// 4. Hierarchical Filtering / Principal's Dashboard (Academic Year First)
// Allows admin to query "Total Due for English Medium, Std 5, Div A for 2025-26" instantly,
// entirely bypassing expensive $lookup joins with the Students collection.
studentFeeLedgerSchema.index({ academicYear: 1, 'snapshot.medium': 1, 'snapshot.standard': 1, 'snapshot.division': 1, status: 1 });

// 5. WhatsApp Reminders Engine / Overdue Queries
// Background cron job fetches all overdue ledgers: { dueDate: { $lt: TODAY }, status: { $in: ['PENDING', 'PARTIAL'] } }
studentFeeLedgerSchema.index({ dueDate: 1, status: 1 });

// 6. Student Specific Due Date Sort (User Requested)
// Useful for parent app or admin views that strictly sort a specific student's timeline by due date chronologically.
studentFeeLedgerSchema.index({ studentId: 1, dueDate: 1 });

// 7. Archive Status
// Used to quickly filter out archived/historical ledgers from massive aggregations.
studentFeeLedgerSchema.index({ isArchived: 1 });

const StudentFeeLedger = mongoose.model('StudentFeeLedger', studentFeeLedgerSchema);

export default StudentFeeLedger;
