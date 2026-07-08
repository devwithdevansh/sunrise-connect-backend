import mongoose from 'mongoose';

const whatsappMessageSchema = new mongoose.Schema(
  {
    // Who composed/sent it (admin/staff user ID)
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Template used
    templateName: {
      type: String,
      required: true,
      default: 'custom_message',
    },

    // Display content (for history viewing)
    body: {
      type: String,
      required: [true, 'Message body is required'],
      trim: true,
    },

    // Who is the audience
    targetType: {
      type: String,
      required: true,
      enum: {
        values: ['ALL', 'CLASS', 'PARENT'],
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

    // WhatsApp delivery results
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },

    // Overall delivery status
    deliveryStatus: {
      type: String,
      enum: ['PENDING', 'SENT', 'PARTIAL_FAIL', 'FAILED', 'NO_NUMBERS'],
      default: 'PENDING',
    },
  },
  { timestamps: true }
);

// Index: admin listing — most recent first
whatsappMessageSchema.index({ createdAt: -1 });

const WhatsappMessage = mongoose.model('WhatsappMessage', whatsappMessageSchema);
export default WhatsappMessage;
