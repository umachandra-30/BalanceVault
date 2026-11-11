import { NextFunction, Request, Response } from 'express';
import { AccountStatus, AccountType, Role } from '@prisma/client';
import { accountService } from '../services/account.service.js';
import { createAccountSchema, updateAccountStatusSchema } from '../schemas/account.schema.js';
import { sendSuccess } from '../utils/response.js';

export const accountController = {
  /**
   * @route POST /api/v1/accounts
   * @desc Open a new financial account (CHECKING or SAVINGS)
   */
  async createAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = createAccountSchema.parse(req.body);
      const userId = req.user!.id;

      const ctx = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const account = await accountService.createAccount(userId, validatedInput, ctx);

      return sendSuccess(res, account, 'Account created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * @route GET /api/v1/accounts
   * @desc List accounts: owned accounts for ACCOUNT_HOLDER, all accounts for ADMIN / AUDITOR
   */
  async listAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId, role } = req.user!;

      if (role === Role.ACCOUNT_HOLDER) {
        const accounts = await accountService.getUserAccounts(userId);
        return sendSuccess(res, accounts, 'User accounts retrieved');
      }

      // ADMIN or AUDITOR platform-wide inspection
      const typeFilter = req.query.type as AccountType | undefined;
      const statusFilter = req.query.status as AccountStatus | undefined;

      const accounts = await accountService.listAllAccounts(typeFilter, statusFilter);
      return sendSuccess(res, accounts, 'Platform accounts retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * @route GET /api/v1/accounts/:id
   * @desc Get account details with strict ownership verification
   */
  async getAccountDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const accountId = req.params.id;
      const { id: userId, role } = req.user!;

      const account = await accountService.getAccountById(accountId, userId, role);

      return sendSuccess(res, account, 'Account details retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * @route GET /api/v1/accounts/:id/balance
   * @desc Get live account balance snapshot with ownership verification
   */
  async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const accountId = req.params.id;
      const { id: userId, role } = req.user!;

      const balanceData = await accountService.getAccountBalance(accountId, userId, role);

      return sendSuccess(res, balanceData, 'Account balance retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * @route PATCH /api/v1/admin/accounts/:id/status
   * @desc Update account status (ACTIVE, FROZEN, CLOSED, PENDING) - ADMIN only
   */
  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = updateAccountStatusSchema.parse(req.body);
      const adminId = req.user!.id;
      const accountId = req.params.id;

      const ctx = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const updatedAccount = await accountService.updateAccountStatus(
        adminId,
        accountId,
        validatedInput,
        ctx
      );

      return sendSuccess(
        res,
        updatedAccount,
        `Account status successfully updated to ${updatedAccount.status}`
      );
    } catch (error) {
      next(error);
    }
  },
};
