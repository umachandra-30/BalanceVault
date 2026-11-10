import { AccountStatus, AccountType, Role, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { CreateAccountInput, UpdateAccountStatusInput } from '../schemas/account.schema.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/response.js';
import { recordAuditLog } from '../utils/audit.js';

export interface ServiceContext {
  ipAddress?: string;
  userAgent?: string;
}

export class AccountService {
  /**
   * Helper function to generate unique formatted account numbers
   */
  private async generateUniqueAccountNumber(): Promise<string> {
    for (let attempts = 0; attempts < 10; attempts++) {
      const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      const candidate = `BV-${randomDigits}`;
      const existing = await prisma.account.findUnique({ where: { accountNumber: candidate } });
      if (!existing) {
        return candidate;
      }
    }
    return `BV-${Date.now()}`;
  }

  /**
   * Create a new financial account (CHECKING or SAVINGS) for an approved user
   */
  async createAccount(userId: string, input: CreateAccountInput, ctx: ServiceContext) {
    // 1. Verify user status
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, role: true },
    });

    if (!user) {
      throw new NotFoundError('User not found.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError(
        'Account opening restricted: Your identity onboarding must be APPROVED by an administrator before creating financial accounts.'
      );
    }

    // 2. Generate unique account number
    const accountNumber = await this.generateUniqueAccountNumber();

    // 3. Create account with exact 0.0000 balance
    const account = await prisma.account.create({
      data: {
        accountNumber,
        userId,
        type: input.type as AccountType,
        currency: input.currency.toUpperCase(),
        status: AccountStatus.ACTIVE,
        balance: 0.0000,
      },
    });

    // 4. Record Audit Log
    await recordAuditLog({
      action: 'ACCOUNT_CREATED',
      actorId: user.id,
      actorRole: user.role,
      targetResource: 'ACCOUNT',
      targetId: account.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { accountNumber: account.accountNumber, type: account.type, currency: account.currency },
    });

    return account;
  }

  /**
   * Get all accounts belonging to the authenticated user
   */
  async getUserAccounts(userId: string) {
    return prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        accountNumber: true,
        type: true,
        currency: true,
        status: true,
        balance: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Get specific account by ID with ownership verification
   */
  async getAccountById(accountId: string, requesterId: string, requesterRole: Role) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    if (!account) {
      throw new NotFoundError('Account not found.');
    }

    // Verify ownership for ACCOUNT_HOLDER
    if (requesterRole === Role.ACCOUNT_HOLDER && account.userId !== requesterId) {
      throw new ForbiddenError('Access denied: You do not own this account.');
    }

    return account;
  }

  /**
   * List all accounts across the platform (for ADMIN and AUDITOR)
   */
  async listAllAccounts(typeFilter?: AccountType, statusFilter?: AccountStatus) {
    return prisma.account.findMany({
      where: {
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update account status (e.g. freeze, unfreeze, close) - ADMIN only
   */
  async updateAccountStatus(
    adminId: string,
    accountId: string,
    input: UpdateAccountStatusInput,
    ctx: ServiceContext
  ) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundError('Account not found.');
    }

    if (account.type === AccountType.SYSTEM_SETTLEMENT) {
      throw new BadRequestError('The system settlement account status cannot be altered.');
    }

    const oldStatus = account.status;
    const newStatus = input.status as AccountStatus;

    const updatedAccount = await prisma.account.update({
      where: { id: accountId },
      data: { status: newStatus },
    });

    await recordAuditLog({
      action: 'ACCOUNT_STATUS_UPDATED',
      actorId: adminId,
      actorRole: 'ADMIN',
      targetResource: 'ACCOUNT',
      targetId: account.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        accountNumber: account.accountNumber,
        oldStatus,
        newStatus,
        reason: input.reason,
      },
    });

    return updatedAccount;
  }
}

export const accountService = new AccountService();

