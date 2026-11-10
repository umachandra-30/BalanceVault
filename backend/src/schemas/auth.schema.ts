import { Role } from '@prisma/client';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string()
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters long')
    .max(100, 'Full name cannot exceed 100 characters')
    .trim(),
  role: z
    .enum(['ACCOUNT_HOLDER', 'AUDITOR', 'ADMIN'] as const)
    .optional()
    .default('ACCOUNT_HOLDER')
    .refine((val) => val !== 'ADMIN', {
      message: 'Privilege escalation rejected: The ADMIN role cannot be self-assigned during registration.',
    }),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim(),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

