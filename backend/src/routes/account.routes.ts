import { Router } from 'express';
import { Role } from '@prisma/client';
import { accountController } from '../controllers/account.controller.js';
import { transactionController } from '../controllers/transaction.controller.js';
import { authenticate, requireAccountOwnership, requireRole } from '../middleware/auth.js';

export const accountRouter = Router();

// Customer and Shared Account operations
accountRouter.post('/', authenticate, accountController.createAccount);
accountRouter.get('/', authenticate, accountController.listAccounts);
accountRouter.get(
  '/:id',
  authenticate,
  requireAccountOwnership('id'),
  accountController.getAccountDetails
);
accountRouter.get(
  '/:id/balance',
  authenticate,
  requireAccountOwnership('id'),
  accountController.getBalance
);
accountRouter.get(
  '/:id/transactions',
  authenticate,
  requireAccountOwnership('id'),
  (req, res, next) => {
    req.query.accountId = req.params.id;
    transactionController.list(req, res, next);
  }
);

export const adminAccountRouter = Router();

// Administrative account operations (Strictly ADMIN only)
adminAccountRouter.patch(
  '/accounts/:id/status',
  authenticate,
  requireRole(Role.ADMIN),
  accountController.updateStatus
);

