// src/models/Payment.js
// Represents a single fee payment transaction (or reversal when amount < 0).

import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentFeeLedger',
      required: [true, 'Ledger ID is required'],
      index: true,
    },
    receiptNumber: {
      type: Number,
      // Optional for backwards compatibility
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      // Negative amounts represent reversals
    },
    concessionAmount: {
      type: Number,
      default: 0,
    },
    method: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: {
        values: ['CASH', 'CHEQUE', 'ONLINE', 'UPI', 'REVERSAL'],
        message: '{VALUE} is not a valid payment method',
      },
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isReversal: {
      type: Boolean,
      default: false,
    },
    // Razorpay gateway transaction ID — indexed for fast reconciliation lookups.
    // sparse: true so null values from cash/cheque payments are not indexed.
    gatewayTransactionId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    // Links a reversal document back to the original payment it cancels.
    // Promotes the old details.reversalOf string to a proper ObjectId reference.
    reversedPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Index: all payments for a ledger, newest first
paymentSchema.index({ ledgerId: 1, createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
