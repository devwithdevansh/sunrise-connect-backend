import mongoose from 'mongoose';

const timetableSchema = new mongoose.Schema(
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
    dayOfWeek: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true,
    },
    periodName: {
      type: String, // e.g. "Period 1", "Period 2", "Recess"
      required: true,
    },
    startTime: {
      type: String, // e.g. "08:00 AM" (or use a Date/Time object, but string HH:MM is usually easier for timetables)
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null, // Null if it's a recess or free period
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Null if recess
    }
  },
  {
    timestamps: true,
  }
);

// Indexes to quickly load a class's timetable
timetableSchema.index({ academicYearId: 1, standard: 1, division: 1, medium: 1, dayOfWeek: 1 });

// Index for conflict checking (a teacher cannot be in two places at the same time on the same day)
timetableSchema.index({ academicYearId: 1, teacherId: 1, dayOfWeek: 1 });

const Timetable = mongoose.model('Timetable', timetableSchema);

export default Timetable;
