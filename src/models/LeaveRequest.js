import mongoose from 'mongoose';

const leaveRequestSchema = new mongoose.Schema(
  {
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    standard: {
      type: String,
      required: true,
    },
    division: {
      type: String,
      required: true,
      uppercase: true,
    },
    medium: {
      type: String,
      required: true,
      enum: ['English', 'Gujarati'],
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
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewRemarks: {
      type: String,
      default: '',
    },
    attachments: [
      {
        url: String,
        name: String,
        fileType: String,
      }
    ]
  },
  {
    timestamps: true,
  }
);

// Indexes for faster querying by class (homeroom teachers)
leaveRequestSchema.index({ academicYearId: 1, standard: 1, division: 1, medium: 1, status: 1 });
leaveRequestSchema.index({ studentId: 1, startDate: -1 });

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);

export default LeaveRequest;
