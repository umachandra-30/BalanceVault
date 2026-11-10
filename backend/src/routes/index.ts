import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { protectedDemoRouter } from './protected-demo.routes.js';

export const apiRouter = Router();

// System health & readiness
apiRouter.use(healthRouter);

// Authentication & Identity
apiRouter.use('/auth', authRouter);

// Protected RBAC and Ownership demonstration routes
apiRouter.use(protectedDemoRouter);
