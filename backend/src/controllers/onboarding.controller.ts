import { NextFunction, Request, Response } from 'express';
import { OnboardingStatus } from '@prisma/client';
import { onboardingService } from '../services/onboarding.service.js';
import { reviewOnboardingSchema, submitOnboardingSchema } from '../schemas/onboarding.schema.js';
import { sendSuccess } from '../utils/response.js';

export const onboardingController = {
  /**
   * @route POST /api/v1/onboarding/submit
   * @desc Submit KYC documents and onboarding request
   */
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = submitOnboardingSchema.parse(req.body);
      const userId = req.user!.id;

      const ctx = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const onboarding = await onboardingService.submitOnboarding(userId, validatedInput, ctx);

      return sendSuccess(
        res,
        onboarding,
        'Onboarding information submitted successfully. Your request is now pending administrator review.',
        200
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * @route GET /api/v1/onboarding/status
   * @desc Check current user's onboarding progress
   */
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const onboarding = await onboardingService.getMyOnboarding(userId);

      return sendSuccess(res, onboarding, 'Onboarding status retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * @route GET /api/v1/admin/onboardings
   * @desc List onboarding requests (ADMIN only)
   */
  async listAll(req: Request, res: Response, next: NextFunction) {
    try {
      const statusFilter = req.query.status as OnboardingStatus | undefined;
      const onboardings = await onboardingService.listOnboardings(statusFilter);

      return sendSuccess(res, onboardings, 'Onboarding applications retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * @route PATCH /api/v1/admin/onboardings/:id/review
   * @desc Approve or Reject onboarding request (ADMIN only)
   */
  async review(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = reviewOnboardingSchema.parse(req.body);
      const adminId = req.user!.id;
      const onboardingId = req.params.id;

      const ctx = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const result = await onboardingService.reviewOnboarding(adminId, onboardingId, validatedInput, ctx);

      return sendSuccess(
        res,
        result,
        `Onboarding application has been ${validatedInput.decision.toLowerCase()}.`,
        200
      );
    } catch (error) {
      next(error);
    }
  },
};
