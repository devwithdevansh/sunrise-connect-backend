// src/validations/payment.schema.js
import { z } from 'zod';

export const createPaymentSchema = {
  body: z.object({
    ledgerId: z.string().min(1),
    amount: z.number().nonnegative(),
    concessionAmount: z.number().nonnegative().optional().default(0),
    method: z.enum(['CASH', 'CHEQUE', 'ONLINE', 'UPI', 'REVERSAL']),
    details: z.record(z.unknown()).optional(),
  }),
};

export const reversePaymentSchema = {
  body: z.object({
    reason: z.string().min(1),
  }),
  params: z.object({ id: z.string().min(1) }),
};

export const listPaymentsSchema = {
  query: z.object({
    ledgerId: z.string().optional(),
    ledgerIds: z.string().optional(),
    isReversal: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(2000).optional(),
    skip: z.coerce.number().int().min(0).optional(),
  }),
};
