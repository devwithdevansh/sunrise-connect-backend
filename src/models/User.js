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
      required: [true, 'Email is required'],
      unique: true, // Index & Validation: Enforces unique accounts and generates a unique B-Tree index for O(1) login lookups.
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
        values: ['ADMIN', 'STAFF'],
        message: '{VALUE} is not a valid role. Allowed values: ADMIN, STAFF.',
      },
      default: 'STAFF', // Security Safeguard: Principle of Least Privilege. If role is accidentally omitted during creation, it defaults to the lowest permission level.
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
