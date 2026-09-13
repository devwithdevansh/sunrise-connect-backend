import mongoose from 'mongoose';

const curriculumSchema = new mongoose.Schema(
  {
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: [true, 'Academic year ID is required'],
    },
    standard: {
      type: String,
      required: [true, 'Standard is required'],
    },
    medium: {
      type: String,
      required: [true, 'Medium is required'],
      enum: ['English', 'Gujarati'],
    },
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
      }
    ]
  },
  {
    timestamps: true,
  }
);

// Ensure a standard+medium has only one curriculum per academic year
curriculumSchema.index({ academicYearId: 1, standard: 1, medium: 1 }, { unique: true });

const Curriculum = mongoose.model('Curriculum', curriculumSchema);

export default Curriculum;
