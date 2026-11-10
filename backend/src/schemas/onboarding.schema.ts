import { z } from 'zod';

export const submitOnboardingSchema = z.object({
  documentType: z.enum(['PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID'], {
    errorMap: () => ({ message: 'Document type must be PASSPORT, DRIVERS_LICENSE, or NATIONAL_ID' }),
  }),
  documentNumber: z
    .string()
    .min(5, 'Document number must be at least 5 characters')
    .max(30, 'Document number cannot exceed 30 characters')
    .trim(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

export const reviewOnboardingSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED'], {
    errorMap: () => ({ message: "Decision must be either 'APPROVED' or 'REJECTED'" }),
  }),
  notes: z.string().max(500, 'Review notes cannot exceed 500 characters').optional(),
});

export type SubmitOnboardingInput = z.infer<typeof submitOnboardingSchema>;
export type ReviewOnboardingInput = z.infer<typeof reviewOnboardingSchema>;

