import { z } from 'zod';

// Regex to validate valid monetary amounts: positive with up to 4 decimal places
const decimalRegex = /^\d+(\.\d{1,4})?$/;

const amountSchema = z
  .union([z.number(), z.string()])
  .transform((val) => String(val))
  .refine((val) => decimalRegex.test(val), {
    message: 'Amount must be a valid positive number with up to 4 decimal places (e.g. 100.5000).',
  })
  .refine((val) => parseFloat(val) > 0, {
    message: 'Amount must be strictly greater than 0.0000.',
  });

export const depositSchema = z.object({
  accountId: z.string().uuid({ message: 'Valid account ID (UUID) is required.' }),
  amount: amountSchema,
  description: z.string().max(255).optional().default('Account deposit'),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const withdrawSchema = z.object({
  accountId: z.string().uuid({ message: 'Valid account ID (UUID) is required.' }),
  amount: amountSchema,
  description: z.string().max(255).optional().default('Account withdrawal'),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const transferSchema = z
  .object({
    sourceAccountId: z.string().uuid({ message: 'Valid source account ID (UUID) is required.' }),
    destinationAccountId: z.string().uuid({ message: 'Valid destination account ID (UUID).' }).optional(),
    destinationAccountNumber: z.string().min(4).max(32).optional(),
    amount: amountSchema,
    description: z.string().max(255).optional().default('Account transfer'),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .refine((data) => data.destinationAccountId || data.destinationAccountNumber, {
    message: 'Either destinationAccountId or destinationAccountNumber must be specified.',
    path: ['destinationAccountNumber'],
  });

export type DepositInput = z.infer<typeof depositSchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;
export type TransferInput = z.infer<typeof transferSchema>;

