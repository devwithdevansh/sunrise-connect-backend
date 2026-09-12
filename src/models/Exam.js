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
    type: {
      type: String,
      enum: ['MARKS', 'GRADES'], // Marks based or Grade based
      required: true,
      default: 'MARKS',
    },
    maxMarks: {
      type: Number,
      default: 100, // Only applicable if type is MARKS
    },
    passingMarks: {
      type: Number,
      default: 35, // Only applicable if type is MARKS
    },
    subjects: [{
      subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
      },
      examDate: Date,
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
