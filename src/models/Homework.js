import mongoose from 'mongoose';

const homeworkSchema = new mongoose.Schema(
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
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    attachments: [
      {
        url: String,
        name: String,
        fileType: String,
      }
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for faster querying by class
homeworkSchema.index({ academicYearId: 1, standard: 1, division: 1, medium: 1, dueDate: -1 });
homeworkSchema.index({ teacherId: 1, dueDate: -1 });

const Homework = mongoose.model('Homework', homeworkSchema);

export default Homework;
