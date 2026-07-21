// src/models/Notification.js
// Stores every push notification ever sent — for admin history + parent inbox
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    // Who composed/sent it (admin/staff user ID)
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Display content
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    body: {
      type: String,
      required: [true, 'Notification body is required'],
      trim: true,
      maxlength: [500, 'Body cannot exceed 500 characters'],
    },

    // Type of notification
    type: {
      type: String,
      required: true,
      enum: {
        values: ['BROADCAST', 'PAYMENT_RECEIVED', 'FEE_REMINDER', 'SYSTEM'],
        message: '{VALUE} is not a valid notification type',
      },
      default: 'BROADCAST',
    },

    // Who is the audience
    targetType: {
      type: String,
      required: true,
      enum: {
        values: ['ALL', 'CLASS', 'PARENT', 'STUDENT'],
        message: '{VALUE} is not a valid target type',
      },
    },

    // Filter used to resolve audience (e.g., { standard: '5', medium: 'English' })
    targetFilter: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Resolved list of parent IDs who received this notification
    targetParentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Parent',
      },
    ],

    // Resolved list of specific student IDs this notification applies to (empty means it applies to all siblings)
    targetStudentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],

    // Per-parent read tracking
    readBy: [
      {
        parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent' },
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
        readAt: { type: Date, default: Date.now },
      },
    ],

    // FCM delivery results
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },

    // Overall delivery status
    deliveryStatus: {
      type: String,
      enum: ['PENDING', 'SENT', 'PARTIAL_FAIL', 'FAILED', 'NO_TOKENS'],
      default: 'PENDING',
    },

    // Optional link to a business entity (for auto notifications)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Index: admin listing — most recent first
notificationSchema.index({ createdAt: -1 });

// Index: parent inbox — find notifications targeting a specific parent
notificationSchema.index({ targetParentIds: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
