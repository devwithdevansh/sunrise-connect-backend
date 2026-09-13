import mongoose from 'mongoose';

const staffLeaveRequestSchema = new mongoose.Schema(
  {
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['SICK', 'CASUAL', 'UNPAID', 'OTHER'],
      default: 'CASUAL',
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: {
      type: String,
      trim: true,
    }
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup
staffLeaveRequestSchema.index({ academicYearId: 1, userId: 1 });
staffLeaveRequestSchema.index({ academicYearId: 1, status: 1 });

const StaffLeaveRequest = mongoose.model('StaffLeaveRequest', staffLeaveRequestSchema);

export default StaffLeaveRequest;
