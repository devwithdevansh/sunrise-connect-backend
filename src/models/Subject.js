import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    subjectName: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
      unique: true, // E.g. "Mathematics" should only exist once
    },
    subjectCode: {
      type: String,
      trim: true,
      unique: true, // E.g. "MAT"
      sparse: true,
    },
    type: {
      type: String,
      enum: ['Theory', 'Practical', 'Both'],
      default: 'Theory',
    },
    gradingSystem: {
      type: String,
      enum: ['Marks', 'Grades'],
      default: 'Marks',
    },
  },
  {
    timestamps: true,
  }
);

const Subject = mongoose.model('Subject', subjectSchema);

export default Subject;
