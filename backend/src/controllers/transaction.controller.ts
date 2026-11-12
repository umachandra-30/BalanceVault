import { NextFunction, Request, Response } from 'express';
import {
  depositSchema,
  transferSchema,
  withdrawSchema,
} from '../schemas/transaction.schema.js';
import { transactionService } from '../services/transaction.service.js';
import { sendSuccess } from '../utils/response.js';

export class TransactionController {
  /**
   * Helper to extract idempotency key from HTTP header or request body
   */
  private extractIdempotencyKey(req: Request): string | undefined {
    const headerKey = req.headers['idempotency-key'];
    if (typeof headerKey === 'string' && headerKey.trim()) {
      return headerKey.trim();
    }
    return req.body?.idempotencyKey;
  }

  /**
   * POST /api/v1/transactions/deposit
   */
  deposit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = depositSchema.parse(req.body);
      const idempotencyKey = this.extractIdempotencyKey(req) || validated.idempotencyKey;

      const result = await transactionService.deposit(
        { ...validated, idempotencyKey },
        {
          userId: req.user!.id,
          userRole: req.user!.role,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.setHeader('X-Idempotent-Replay', String(result.isIdempotentReplay));
      sendSuccess(
        res,
        result.data,
        result.isIdempotentReplay ? 'Idempotent deposit replayed' : 'Deposit successfully processed',
        201
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/transactions/withdraw
   */
  withdraw = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = withdrawSchema.parse(req.body);
      const idempotencyKey = this.extractIdempotencyKey(req) || validated.idempotencyKey;

      const result = await transactionService.withdraw(
        { ...validated, idempotencyKey },
        {
          userId: req.user!.id,
          userRole: req.user!.role,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.setHeader('X-Idempotent-Replay', String(result.isIdempotentReplay));
      sendSuccess(
        res,
        result.data,
        result.isIdempotentReplay ? 'Idempotent withdrawal replayed' : 'Withdrawal successfully processed',
        201
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/transactions/transfer
   */
  transfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = transferSchema.parse(req.body);
      const idempotencyKey = this.extractIdempotencyKey(req) || validated.idempotencyKey;

      const result = await transactionService.transfer(
        { ...validated, idempotencyKey },
        {
          userId: req.user!.id,
          userRole: req.user!.role,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.setHeader('X-Idempotent-Replay', String(result.isIdempotentReplay));
      sendSuccess(
        res,
        result.data,
        result.isIdempotentReplay ? 'Idempotent transfer replayed' : 'Transfer successfully completed',
        201
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/transactions
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accountId = req.query.accountId as string | undefined;
      const type = req.query.type as any;
      const search = req.query.search as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const { transactions, meta } = await transactionService.listTransactions(
        {
          userId: req.user!.id,
          userRole: req.user!.role,
        },
        {
          accountId,
          type,
          search,
          startDate,
          endDate,
          page,
          limit,
        }
      );

      sendSuccess(res, transactions, 'Transactions retrieved successfully', 200, meta);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/transactions/:id
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await transactionService.getTransactionById(req.params.id, {
        userId: req.user!.id,
        userRole: req.user!.role,
      });

      sendSuccess(res, data, 'Transaction details retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}

export const transactionController = new TransactionController();

