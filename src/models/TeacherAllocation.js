import mongoose from 'mongoose';

const teacherAllocationSchema = new mongoose.Schema(
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
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    }
  },
  {
    timestamps: true,
  }
);

// One teacher per subject per class per year.
teacherAllocationSchema.index(
  { academicYearId: 1, standard: 1, division: 1, medium: 1, subjectId: 1 },
  { unique: true }
);

const TeacherAllocation = mongoose.model('TeacherAllocation', teacherAllocationSchema);

export default TeacherAllocation;
