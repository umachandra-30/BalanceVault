import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole, requireAccountOwnership } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

export const protectedDemoRouter = Router();

/**
 * @route GET /api/v1/admin/overview
 * @desc Protected endpoint accessible ONLY by ADMIN
 */
protectedDemoRouter.get(
  '/admin/overview',
  authenticate,
  requireRole(Role.ADMIN),
  (req: Request, res: Response) => {
    return sendSuccess(res, {
      message: 'Admin access granted',
      adminUser: req.user?.email,
      systemStatus: 'ALL_SYSTEMS_OPERATIONAL',
    });
  }
);

/**
 * @route GET /api/v1/auditor/ledger-summary
 * @desc Protected endpoint accessible by AUDITOR and ADMIN (read-only audit report)
 */
protectedDemoRouter.get(
  '/auditor/ledger-summary',
  authenticate,
  requireRole(Role.AUDITOR, Role.ADMIN),
  (req: Request, res: Response) => {
    return sendSuccess(res, {
      message: 'Auditor access granted',
      auditorUser: req.user?.email,
      scope: 'READ_ONLY_AUDIT_TRAIL',
    });
  }
);

/**
 * @route GET /api/v1/accounts/:accountId/details
 * @desc Protected endpoint enforcing account ownership
 */
protectedDemoRouter.get(
  '/accounts/:accountId/details',
  authenticate,
  requireAccountOwnership('accountId'),
  (req: Request, res: Response) => {
    return sendSuccess(res, {
      message: 'Account ownership verified',
      account: req.targetAccount,
    });
  }
);

/**
 * @route POST /api/v1/accounts/:accountId/mutate
 * @desc Protected endpoint mutating account — ensures AUDITOR role cannot execute POST mutations
 */
protectedDemoRouter.post(
  '/accounts/:accountId/mutate',
  authenticate,
  requireAccountOwnership('accountId'),
  (req: Request, res: Response) => {
    return sendSuccess(res, {
      message: 'Account mutation permitted',
      account: req.targetAccount,
    });
  }
);
