// src/validations/auth.schema.js
import { z } from 'zod';

export const portalLoginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
  }),
};

export const verifyParentSchema = {
  body: z.object({
    primaryMobileNumber: z.string().regex(/^[6-9]\d{9}$/, 'Enter Indian number or invalid number'),
    lastFourDigits: z.string().length(4).regex(/^\d{4}$/),
  }),
};

export const setPasswordSchema = {
  body: z.object({
    parentId: z.string().min(1),
    newPassword: z.string().min(8),
  }),
};

export const parentLoginSchema = {
  body: z.object({
    primaryMobileNumber: z.string().regex(/^[6-9]\d{9}$/, 'Enter Indian number or invalid number'),
    password: z.string().min(1),
  }),
};

export const teacherLoginSchema = {
  body: z.object({
    last5: z.string().regex(/^\d{5}$/, 'Enter the last 5 digits of your registered mobile number'),
    password: z.string().min(1),
  }),
};

export const unifiedLoginSchema = {
  body: z.object({
    mobileNumber: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
    password: z.string().min(1, 'Password is required'),
  }),
};

export const refreshTokenSchema = {
  body: z.object({
    domain: z.enum(['parent', 'user']),
    userId: z.string().min(1),
    refreshToken: z.string().min(1),
  }),
};
