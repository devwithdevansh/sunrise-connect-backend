import mongoose from 'mongoose';

const examResultSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    marksObtained: {
      type: Number, // If exam type is MARKS
    },
    gradeObtained: {
      type: String, // If exam type is GRADES (e.g. A+, B)
    },
    remarks: {
      type: String,
      trim: true,
    },
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One result per student, per exam, per subject
examResultSchema.index({ examId: 1, studentId: 1, subjectId: 1 }, { unique: true });
examResultSchema.index({ studentId: 1 });

const ExamResult = mongoose.model('ExamResult', examResultSchema);

export default ExamResult;
