import mongoose from 'mongoose';

const feeCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Fee category name is required'],
      trim: true,
      maxlength: [100, 'Fee category name cannot exceed 100 characters'],
    },
    type: {
      type: String,
      required: [true, 'Fee category type is required'],
      enum: {
        values: ['EDUCATION', 'TERM', 'TRANSPORT', 'ADMISSION', 'OTHER', 'BAG_KIT'],
        message: '{VALUE} is not a valid fee category type',
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [250, 'Description cannot exceed 250 characters'],
      default: null,
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
feeCategorySchema.index({ name: 1 }, { unique: true });

// 1. Filtering by Category Type and Status
// Optimized for admin screens that need to load specific types of active fees 
// (e.g., "Give me all active ADMISSION type categories")
feeCategorySchema.index({ type: 1, isActive: 1 });

const FeeCategory = mongoose.model('FeeCategory', feeCategorySchema);

export default FeeCategory;
