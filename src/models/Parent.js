// src/models/Parent.js
import mongoose from 'mongoose';

const parentSchema = new mongoose.Schema(
  {
    parentName: {
      type: String,
      required: [true, 'Parent name is required'],
      trim: true,
      maxlength: [100, 'Parent name cannot exceed 100 characters'],
    },
    primaryMobileNumber: {
      type: String,
      required: [true, 'Primary mobile number is required'],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Enter Indian number or invalid number'],
    },
    secondaryMobileNumber: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Enter Indian number or invalid number'],
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      default: null,
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, 'Address cannot exceed 500 characters'],
      default: null,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    isPasswordSet: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Refresh token storage – hashed token + expiry
    refreshTokens: [
      {
        tokenHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
      },
    ],

  },
  { timestamps: true }
);

// Index for secondary mobile number – unique when present
parentSchema.index(
  { secondaryMobileNumber: 1 },
  { unique: true, partialFilterExpression: { secondaryMobileNumber: { $type: 'string' } } }
);

const Parent = mongoose.model('Parent', parentSchema);
export default Parent;
