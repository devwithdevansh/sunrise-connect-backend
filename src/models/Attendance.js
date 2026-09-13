import mongoose from 'mongoose';

const attendanceRecordSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'],
      required: true,
      default: 'PRESENT',
    },
    remarks: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    // Optional/nullable so existing documents stay valid; new saves always set it.
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      default: null,
    },
    date: {
      type: Date,
      required: true,
    },
    standard: {
      type: String,
      required: true,
      trim: true,
    },
    division: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    medium: {
      type: String,
      required: true,
      enum: ['English', 'Gujarati'],
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    records: [attendanceRecordSchema],
  },
  {
    timestamps: true,
  }
);

// Ensure only one attendance sheet per class per day
attendanceSchema.index({ date: 1, standard: 1, division: 1, medium: 1 }, { unique: true });
// Reporting by academic year (e.g. "this year's attendance %"), matching the
// convention every other academic model uses.
attendanceSchema.index({ academicYearId: 1, standard: 1, division: 1, medium: 1 });

export default mongoose.model('Attendance', attendanceSchema);
