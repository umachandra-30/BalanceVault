import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { onboardingRouter, adminOnboardingRouter } from './onboarding.routes.js';
import { accountRouter, adminAccountRouter } from './account.routes.js';
import transactionRouter from './transaction.routes.js';
import auditRouter from './audit.routes.js';
import { protectedDemoRouter } from './protected-demo.routes.js';

export const apiRouter = Router();

// System health & readiness
apiRouter.use(healthRouter);

// Authentication & Identity
apiRouter.use('/auth', authRouter);

// Account Onboarding Flow
apiRouter.use('/onboarding', onboardingRouter);

// Financial Accounts
apiRouter.use('/accounts', accountRouter);

// Core Financial Operations & Double-Entry Ledger
apiRouter.use('/transactions', transactionRouter);

// Audit Logging & Compliance Trail (Admin & Auditor)
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/admin/audit-logs', auditRouter);

// Admin Operations (Onboarding review & account administration)
apiRouter.use('/admin', adminOnboardingRouter);
apiRouter.use('/admin', adminAccountRouter);

// Protected RBAC and Ownership demonstration routes
apiRouter.use(protectedDemoRouter);

