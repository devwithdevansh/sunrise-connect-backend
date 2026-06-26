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

export const refreshTokenSchema = {
  body: z.object({
    domain: z.enum(['parent', 'user']),
    userId: z.string().min(1),
    refreshToken: z.string().min(1),
  }),
};
