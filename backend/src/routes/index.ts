import { Router } from 'express';
import { healthRouter } from './health.routes.js';

export const apiRouter = Router();

// Mount system health & readiness endpoints
apiRouter.use(healthRouter);

// Future endpoints will be mounted here cleanly:
// apiRouter.use('/auth', authRouter);
// apiRouter.use('/accounts', accountsRouter);
// apiRouter.use('/transfers', transfersRouter);
// apiRouter.use('/ledger', ledgerRouter);
// apiRouter.use('/admin', adminRouter);
// apiRouter.use('/audit', auditRouter);

