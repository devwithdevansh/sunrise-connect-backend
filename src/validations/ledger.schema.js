// src/validations/ledger.schema.js
import { z } from 'zod';

const snapshotSchema = z.object({
  studentName: z.string().min(1),
  medium: z.string().min(1),
  standard: z.string().min(1),
  division: z.string().min(1),
  transportType: z.string().min(1),
  isRTE: z.boolean(),
});

export const createLedgerSchema = {
  body: z.object({
    studentId: z.string().min(1),
    academicYear: z.string().min(1),
    feeCategoryId: z.string().min(1),
    feePeriod: z.string().min(1),
    feeType: z.enum(['EDUCATION', 'TERM', 'TRANSPORT', 'ADMISSION', 'OTHER', 'BAG_KIT']),
    ledgerNumber: z.string().min(1),
    totalAmount: z.number().nonnegative(),
    dueDate: z.string().datetime(),
    source: z.enum(['GENERATED', 'MIGRATED', 'MANUAL']),
    generatedFrom: z.enum(['FEE_STRUCTURE', 'TRANSPORT_STRUCTURE', 'MIGRATION']),
    snapshot: snapshotSchema,
    remarks: z.string().optional().nullable(),
  }),
};

export const addPaymentSchema = {
  body: z.object({
    amount: z.number().positive(),
    details: z.record(z.unknown()).optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
};

export const concessionSchema = {
  body: z.object({
    amount: z.number().positive(),
    reason: z.string().min(1),
  }),
  params: z.object({ id: z.string().min(1) }),
};

export const listLedgersSchema = {
  query: z.object({
    studentId: z.string().optional(),
    status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'WAIVED', 'CANCELLED']).optional(),
    academicYear: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(2000).optional(),
    skip: z.coerce.number().int().min(0).optional(),
  }),
};
