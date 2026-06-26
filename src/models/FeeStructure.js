import mongoose from 'mongoose';

const feeStructureSchema = new mongoose.Schema(
  {
    medium: {
      type: String,
      required: [true, 'Medium of instruction is required'],
      enum: {
        values: ['English', 'Gujarati'],
        message: '{VALUE} is not a valid medium',
      },
    },
    standard: {
      type: String,
      required: [true, 'Standard is required'],
      trim: true,
    },
    annualFee: {
      type: Number,
      required: [true, 'Annual fee is required'],
      min: [0, 'Annual fee cannot be negative'],
    },
    educationPartCount: {
      type: Number,
      required: [true, 'Education part count is required (e.g., 12 months)'],
      min: [1, 'Must have at least 1 education fee part'],
      default: 12,
    },
    termPartCount: {
      type: Number,
      required: [true, 'Term part count is required (e.g., 2 terms)'],
      min: [0, 'Term part count cannot be negative'],
      default: 2,
    },
    // Additional fee components editable by admin
    admissionFee: {
      type: Number,
      min: [0, 'Admission fee cannot be negative'],
      default: 0,
    },
    bagKitFee: {
      type: Number,
      min: [0, 'Bag & Kit fee cannot be negative'],
      default: 0,
    },
    termFee: {
      type: Number,
      min: [0, 'Term fee cannot be negative'],
      default: 0,
    },
    applicableFeeCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FeeCategory',
        required: true,
      },
    ],
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

// 1. Unique Compound Index (Medium + Standard)
// Ensures we never accidentally create two different master fee structures for the exact same medium and standard.
feeStructureSchema.index({ medium: 1, standard: 1 }, { unique: true });

// 2. Active Status Filtering Index
// Useful when fetching all active structures to populate dropdowns on the admin dashboard.
feeStructureSchema.index({ isActive: 1 });

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);

export default FeeStructure;
