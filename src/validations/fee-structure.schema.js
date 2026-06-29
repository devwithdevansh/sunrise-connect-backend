import { z } from 'zod';

export const createFeeStructureSchema = {
  body: z.object({
    academicYear: z.string().min(1),
    medium: z.enum(['English', 'Gujarati']),
    standard: z.string().min(1),
    annualFee: z.number().nonnegative(),
    educationPartCount: z.number().int().positive().default(12),
    termPartCount: z.number().int().nonnegative().default(2),
    termFee: z.number().nonnegative().default(0),
    admissionFee: z.number().nonnegative().default(0),
    bagKitFee: z.number().nonnegative().default(0),
    applicableFeeCategories: z.array(z.string()).optional(),
  }),
};

export const createTransportFeeStructureSchema = {
  body: z.object({
    academicYear: z.string().min(1),
    transportType: z.enum(['Railnagar', 'Outside Railnagar']),
    amount: z.number().nonnegative(),
    frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
  }),
};

export const updateFeeStructureSchema = {
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    annualFee: z.number().nonnegative().optional(),
    educationPartCount: z.number().int().positive().optional(),
    termPartCount: z.number().int().nonnegative().optional(),
    termFee: z.number().nonnegative().optional(),
    admissionFee: z.number().nonnegative().optional(),
    bagKitFee: z.number().nonnegative().optional(),
    isActive: z.boolean().optional(),
  }),
};

export const updateTransportFeeStructureSchema = {
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    amount: z.number().nonnegative().optional(),
    frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
    isActive: z.boolean().optional(),
  }),
};
