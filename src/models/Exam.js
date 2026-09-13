import mongoose from 'mongoose';

const examSchema = new mongoose.Schema(
  {
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    standard: {
      type: String,
      required: true,
    },
    // We can allow exams across a whole standard (all divisions) or specific divisions
    divisions: [{
      type: String,
      uppercase: true,
    }],
    medium: {
      type: String,
      required: true,
      enum: ['English', 'Gujarati'],
    },
    examName: {
      type: String, // e.g. "Mid Term", "Finals", "Weekly Test"
      required: true,
      trim: true,
    },
    subjects: [{
      subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
      },
      examDate: Date,
      gradingSystem: {
        type: String,
        enum: ['Marks', 'Grades'],
        default: 'Marks',
      },
      maxMarks: {
        type: Number,
        default: 100, // Only applicable if gradingSystem is Marks
      },
      passingMarks: {
        type: Number,
        default: 35, // Only applicable if gradingSystem is Marks
      }
    }],
    isPublished: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }
  },
  {
    timestamps: true,
  }
);

// Indexes
examSchema.index({ academicYearId: 1, standard: 1, medium: 1 });

const Exam = mongoose.model('Exam', examSchema);

export default Exam;
