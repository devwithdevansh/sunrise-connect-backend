import mongoose from 'mongoose';

const classTeacherAllocationSchema = new mongoose.Schema(
  {
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
    }
  },
  {
    timestamps: true,
  }
);

// One homeroom teacher per class per year.
classTeacherAllocationSchema.index(
  { academicYearId: 1, standard: 1, division: 1, medium: 1 },
  { unique: true }
);

const ClassTeacherAllocation = mongoose.model('ClassTeacherAllocation', classTeacherAllocationSchema);

export default ClassTeacherAllocation;
