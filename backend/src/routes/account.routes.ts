import { Router } from 'express';
import { Role } from '@prisma/client';
import { accountController } from '../controllers/account.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export const accountRouter = Router();

// Customer and Shared Account operations
accountRouter.post('/', authenticate, accountController.createAccount);
accountRouter.get('/', authenticate, accountController.listAccounts);
accountRouter.get('/:id', authenticate, accountController.getAccountDetails);
accountRouter.get('/:id/balance', authenticate, accountController.getBalance);

export const adminAccountRouter = Router();

// Administrative account operations (Strictly ADMIN only)
adminAccountRouter.patch(
  '/accounts/:id/status',
  authenticate,
  requireRole(Role.ADMIN),
  accountController.updateStatus
);
