import mongoose from 'mongoose';

const transportFeeStructureSchema = new mongoose.Schema(
  {
    academicYear: {
      type: String,
      required: [true, 'Academic year mapping is required'],
      trim: true,
    },
    transportType: {
      type: String,
      required: [true, 'Transport type is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Transport fee amount is required'],
      min: [0, 'Transport fee cannot be negative'],
    },
    frequency: {
      type: String,
      required: [true, 'Fee frequency is required'],
      enum: {
        values: ['MONTHLY', 'QUARTERLY', 'YEARLY'],
        message: '{VALUE} is not a valid frequency',
      },
      default: 'MONTHLY',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Indexes

// 1. Partial Unique Index (Crucial for preventing duplicates)
// This strictly enforces that there can be ONLY ONE "Active" configuration per transport type and year at any time.
transportFeeStructureSchema.index(
  { academicYear: 1, transportType: 1 },
  { 
    unique: true, 
    partialFilterExpression: { isActive: true } 
  }
);

// 2. Query Optimization Index
transportFeeStructureSchema.index({ academicYear: 1, transportType: 1, isActive: 1 });

const TransportFeeStructure = mongoose.model('TransportFeeStructure', transportFeeStructureSchema);

export default TransportFeeStructure;
