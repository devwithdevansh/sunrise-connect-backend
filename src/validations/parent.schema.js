// src/validations/parent.schema.js
import { z } from 'zod';

const mobileRegex = /^[6-9]\d{9}$/;

export const createParentSchema = {
  body: z.object({
    parentName: z.string().min(1).max(100),
    primaryMobileNumber: z.string().regex(mobileRegex, 'Enter Indian number or invalid number'),
    secondaryMobileNumber: z.string().regex(mobileRegex, 'Enter Indian number or invalid number').optional().nullable(),
    email: z.string().email().optional().nullable(),
    address: z.string().max(500).optional().nullable(),
  }),
};

export const updateParentSchema = {
  body: z.object({
    parentName: z.string().min(1).max(100).optional(),
    secondaryMobileNumber: z.string().regex(mobileRegex, 'Enter Indian number or invalid number').optional().nullable(),
    email: z.string().email().optional().nullable(),
    address: z.string().max(500).optional().nullable(),
  }),
  params: z.object({ id: z.string().min(1) }),
};

export const resetPasswordSchema = {
  body: z.object({
    primaryMobileNumber: z.string().regex(mobileRegex, 'Enter Indian number or invalid number'),
    lastFourDigits: z.string().length(4).regex(/^\d{4}$/),
  }),
};

export const listParentsSchema = {
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    skip: z.coerce.number().int().min(0).optional(),
  }),
};

export const checkMobileSchema = {
  query: z.object({
    primaryMobile: z.string().optional(),
    secondaryMobile: z.string().optional()
  }).refine(data => data.primaryMobile || data.secondaryMobile, {
    message: "At least one mobile number must be provided"
  }),
};
