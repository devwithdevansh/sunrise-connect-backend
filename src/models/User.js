import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true, // Validation Decision: Eliminates accidental leading/trailing whitespace which breaks UI alignment.
      maxlength: [100, 'Name cannot exceed 100 characters'], // Security Safeguard: Prevents massive string payload injection attacks.
    },
    email: {
      type: String,
      unique: true, // Index & Validation: Enforces unique accounts and generates a unique B-Tree index for O(1) login lookups.
      sparse: true, // Allows email to be missing/null if phone is used for login
      trim: true,
      lowercase: true, // Validation Decision: Normalizes emails (e.g., 'Admin@school.com' becomes 'admin@school.com') to prevent duplicate accounts via case variations.
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'], // Validation Decision: Strict Regex ensures only mathematically valid email formats enter the DB.
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Security Safeguard: This is the most critical line. It physically prevents Mongoose from returning the password hash in `find()` queries, stopping accidental data leaks in API responses.
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ['ADMIN', 'STAFF', 'TEACHER'],
        message: '{VALUE} is not a valid role. Allowed values: ADMIN, STAFF, TEACHER.',
      },
      default: 'STAFF', // Security Safeguard: Principle of Least Privilege. If role is accidentally omitted during creation, it defaults to the lowest permission level.
    },
    permissions: {
      type: [String],
      default: [],
    },
    dob: { type: Date, default: null },
    aadharNo: { type: String, trim: true, default: null },
    panNo: { type: String, trim: true, default: null },
    contactNo1: { 
      type: String, 
      trim: true, 
      default: null,
      unique: true, 
      sparse: true // Allows multiple nulls, but real numbers must be unique
    },
    contactNo2: { type: String, trim: true, default: null },
    address: { type: String, trim: true, default: null },
    photoUrl: { type: String, trim: true, default: null },
    designation: { type: String, trim: true, default: null },
    experience: { type: String, trim: true, default: null },
    educationDetails: { type: Array, default: [] },
    shift1: {
      entry: { type: String, default: null },
      exit: { type: String, default: null }
    },
    shift2: {
      entry: { type: String, default: null },
      exit: { type: String, default: null }
    },
    teacherProfile: {
      isClassTeacherFor: {
        standard: { type: String, default: null },
        division: { type: String, default: null },
        medium: { type: String, default: null }
      },
      subjectsAssigned: {
        type: [
          {
            subjectName: { type: String, required: true },
            standard: { type: String, required: true },
            division: { type: String, required: true },
            medium: { type: String, required: true }
          }
        ],
        default: []
      }
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, // Index Decision: Allows O(1) filtering when the Admin queries "Show me all active staff members".
    },
    lastLogin: {
      type: Date,
      default: null, // Validation Decision: Initialized as null because a brand new staff member has never logged in.
    },
    // Refresh token storage – hashed token + expiry (select: false for security)
    refreshTokens: {
      type: [
        {
          tokenHash: { type: String, required: true },
          expiresAt: { type: Date, required: true },
        },
      ],
      select: false,
      default: [],
    },
    // FCM push tokens — mirrors Parent.fcmTokens exactly, so Staff/Teachers
    // can receive pushes too (e.g. new chat messages, leave requests to review).
    fcmTokens: [
      {
        token: { type: String, required: true },
        platform: { type: String, default: 'android', enum: ['android', 'ios', 'web'] },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt fields for auditing.
  }
);

// ==========================================
// ADDITIONAL INDEXING STRATEGY
// ==========================================

// Role & Active Status Compound Index
// Why it exists: When rendering the Staff Management portal, admins frequently filter by "Role = STAFF" and "Active = True".
// This compound index satisfies that exact query instantly without full collection scans.
userSchema.index({ role: 1, isActive: 1 });

const User = mongoose.model('User', userSchema);

export default User;
