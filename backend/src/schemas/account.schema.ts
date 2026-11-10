import { z } from 'zod';

export const createAccountSchema = z.object({
  type: z.enum(['CHECKING', 'SAVINGS'], {
    errorMap: () => ({ message: "Account type must be 'CHECKING' or 'SAVINGS'" }),
  }),
  currency: z.string().length(3, 'Currency must be a 3-letter ISO code (e.g., USD)').default('USD'),
});

export const updateAccountStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED'], {
    errorMap: () => ({ message: "Status must be 'ACTIVE', 'FROZEN', or 'CLOSED'" }),
  }),
  reason: z.string().min(3, 'A reason for status change is required').max(250),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountStatusInput = z.infer<typeof updateAccountStatusSchema>;

