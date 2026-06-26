import mongoose from 'mongoose';

const transportFeeStructureSchema = new mongoose.Schema(
  {
    transportType: {
      type: String,
      required: [true, 'Transport type is required'],
      enum: {
        values: ['Railnagar', 'Outside Railnagar'],
        message: '{VALUE} is not a valid transport type',
      },
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
// This strictly enforces that there can be ONLY ONE "Active" configuration per transport type at any time.
// However, it allows you to have unlimited "Inactive" (historical/legacy) configurations for the same route from previous years.
transportFeeStructureSchema.index(
  { transportType: 1 },
  { 
    unique: true, 
    partialFilterExpression: { isActive: true } 
  }
);

// 2. Query Optimization Index
// During cron jobs or monthly ledger generation, the engine will query specifically for { isActive: true, transportType: 'Railnagar' }
transportFeeStructureSchema.index({ transportType: 1, isActive: 1 });

const TransportFeeStructure = mongoose.model('TransportFeeStructure', transportFeeStructureSchema);

export default TransportFeeStructure;
