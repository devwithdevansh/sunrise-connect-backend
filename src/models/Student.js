import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parent',
      required: false,
    },
    studentCode: {
      type: String,
      unique: true,
      trim: true,
    },
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
      maxlength: [100, 'Student name cannot exceed 100 characters'],
    },
    medium: {
      type: String,
      required: [true, 'Medium of instruction is required'],
      enum: {
        values: ['English', 'Gujarati'],
        message: '{VALUE} is not a valid medium',
      },
    },
    standard: {
      type: String,
      required: [true, 'Standard is required'],
      trim: true,
    },
    division: {
      type: String,
      required: [true, 'Division is required'],
      trim: true,
      uppercase: true, // Auto-convert 'a' to 'A'
    },
    transportType: {
      type: String,
      required: [true, 'Transport type is required'],
      enum: {
        values: ['Railnagar', 'Outside Railnagar', 'None'],
        message: '{VALUE} is not a valid transport type',
      },
      default: 'None',
    },
    isRTE: {
      type: Boolean,
      default: false,
    },
    isNewAdmission: {
      type: Boolean,
      default: false,
    },
    admissionMonth: {
      type: String,
      default: 'June',
      enum: {
        values: ['June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May'],
        message: '{VALUE} is not a valid month',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Indexes

// 1. Foreign Key Index
// Essential for Parent App login. When a parent logs in, we need to instantly fetch all their children.
studentSchema.index({ parentId: 1 });

// 1.5 Duplicate Prevention Index (Migration Safety)
// Enforces that a single household cannot register the same child twice in the same medium.
// Intentionally omits 'standard' so the uniqueness constraint survives yearly promotions.
studentSchema.index({ parentId: 1, studentName: 1, medium: 1 }, { unique: true });

// 2. Search Optimization Index
// A standard B-tree index on the name allows for highly efficient prefix-based regex searches (e.g., /^John/i).
studentSchema.index({ studentName: 1 });

// 3. Hierarchical Filtering Compound Index
// Used extensively for Admin Reports and Fee Generation. 
// Queries filtering by Medium, then Standard, then Division will hit this single index.
studentSchema.index({ medium: 1, standard: 1, division: 1 });

// 4. Single Field Filtering Indexes
// For targeted operations like generating monthly transport fees or filtering RTE students.
studentSchema.index({ transportType: 1 });
studentSchema.index({ isRTE: 1 });
studentSchema.index({ isActive: 1 });

const Student = mongoose.model('Student', studentSchema);

export default Student;
