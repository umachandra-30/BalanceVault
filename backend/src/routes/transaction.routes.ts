import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller.js';
import { authenticate, requireAccountOwnership } from '../middleware/auth.js';

const router = Router();

// Apply authentication to all transaction endpoints
router.use(authenticate);

// Financial Operations (with Account Ownership validation)
router.post(
  '/deposit',
  requireAccountOwnership('accountId'),
  transactionController.deposit
);

router.post(
  '/withdraw',
  requireAccountOwnership('accountId'),
  transactionController.withdraw
);

router.post(
  '/transfer',
  requireAccountOwnership('sourceAccountId'),
  transactionController.transfer
);

// Transaction History & Audit Inspection
router.get('/', transactionController.list);
router.get('/:id', transactionController.getById);

export default router;
