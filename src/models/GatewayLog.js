// src/models/GatewayLog.js
// Dedicated collection for storing raw payment gateway webhooks and API responses
// Keeps the accounting Payment ledger clean and separated.

import mongoose from 'mongoose';

const gatewayLogSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: [true, 'Gateway payment ID is required'],
      index: true,
      unique: true,
    },
    orderId: {
      type: String,
      required: [true, 'Gateway order ID is required'],
      index: true,
    },
    method: {
      type: String,
      // e.g. 'upi', 'netbanking', 'card', 'wallet'
    },
    amount: {
      type: Number,
      // The amount in rupees (converted from paisa if Razorpay)
    },
    status: {
      type: String,
    },
    gateway: {
      type: String,
      default: 'RAZORPAY',
      enum: ['RAZORPAY'],
    },
    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      // The complete, unmodified JSON payload from the gateway
    },
  },
  { timestamps: true }
);

// Index for fast lookups by order
gatewayLogSchema.index({ orderId: 1, createdAt: -1 });

const GatewayLog = mongoose.model('GatewayLog', gatewayLogSchema);

export default GatewayLog;
