import { Router } from 'express';
import { Role } from '@prisma/client';
import { onboardingController } from '../controllers/onboarding.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export const onboardingRouter = Router();

// Customer onboarding endpoints (Requires authenticated user)
onboardingRouter.post('/submit', authenticate, onboardingController.submit);
onboardingRouter.get('/status', authenticate, onboardingController.getStatus);

export const adminOnboardingRouter = Router();

// Administrative onboarding review endpoints (Strictly ADMIN only)
adminOnboardingRouter.get('/onboardings', authenticate, requireRole(Role.ADMIN), onboardingController.listAll);
adminOnboardingRouter.patch('/onboardings/:id/review', authenticate, requireRole(Role.ADMIN), onboardingController.review);

