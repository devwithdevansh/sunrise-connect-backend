import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Expense title is required'],
      trim: true,
      maxlength: [150, 'Expense title cannot exceed 150 characters'],
    },
    category: {
      type: String,
      required: [true, 'Expense category is required'],
      enum: {
        values: [
          'Tea & Snacks',
          'Stationery & Office Supplies',
          'Maintenance & Repairs',
          'Utilities & Electricity',
          'Transport & Fuel',
          'Staff & Welfare',
          'Miscellaneous'
        ],
        message: '{VALUE} is not a valid expense category',
      },
      default: 'Miscellaneous',
    },
    amount: {
      type: Number,
      required: [true, 'Expense amount is required'],
      min: [0, 'Expense amount cannot be negative'],
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'BANK', 'ONLINE'],
      default: 'CASH',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isReversed: {
      type: Boolean,
      default: false,
    },
    reversedAt: {
      type: Date,
      default: null,
    },
    reversedReason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Index for date filtering
expenseSchema.index({ date: -1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
