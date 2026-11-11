import {
  Account,
  AccountStatus,
  AccountType,
  LedgerDirection,
  Prisma,
  Role,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import { DepositInput, TransferInput, WithdrawInput } from '../schemas/transaction.schema.js';
import { recordAuditLog } from '../utils/audit.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/response.js';

export interface TransactionServiceContext {
  userId: string;
  userRole: Role;
  ipAddress?: string;
  userAgent?: string;
}

export class TransactionService {
  /**
   * Helper to ensure idempotency key resolution and replay protection.
   */
  private async processWithIdempotency<T>(
    idempotencyKey: string | undefined,
    endpoint: string,
    context: TransactionServiceContext,
    requestPayload: Record<string, unknown>,
    operation: (tx: Prisma.TransactionClient, key: string) => Promise<T>
  ): Promise<{ data: T; isIdempotentReplay: boolean }> {
    const activeKey = idempotencyKey || `idem_${crypto.randomUUID()}`;

    // Create stable hash of request parameters to detect payload tampering
    const payloadHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          endpoint,
          userId: context.userId,
          payload: requestPayload,
        })
      )
      .digest('hex');

    // 1. Check if idempotency key has already been recorded
    const existingKey = await prisma.idempotencyKey.findUnique({
      where: { key: activeKey },
    });

    if (existingKey) {
      if (existingKey.requestHash !== payloadHash) {
        throw new ConflictError(
          'Idempotency key was previously used with a different request payload or user.'
        );
      }
      return {
        data: existingKey.responseBody as unknown as T,
        isIdempotentReplay: true,
      };
    }

    // 2. Execute operation inside an atomic database transaction
    const result = await prisma.$transaction(
      async (tx) => {
        return await operation(tx, activeKey);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      }
    );

    // 3. Persist idempotency record (24 hour retention)
    await prisma.idempotencyKey.create({
      data: {
        key: activeKey,
        endpoint,
        requestHash: payloadHash,
        responseStatus: 200,
        responseBody: result as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return {
      data: result,
      isIdempotentReplay: false,
    };
  }

  /**
   * Row-level locking helper: Locks accounts in deterministic ascending order by ID to prevent deadlocks.
   */
  private async lockAccountsInOrder(
    tx: Prisma.TransactionClient,
    accountIds: string[]
  ): Promise<void> {
    const sortedUniqueIds = [...new Set(accountIds)].sort();
    for (const id of sortedUniqueIds) {
      await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${id} FOR UPDATE`;
    }
  }

  /**
   * Locate the central active bank settlement account
   */
  private async getSystemSettlementAccount(
    tx: Prisma.TransactionClient
  ): Promise<Account> {
    const settlementAccount = await tx.account.findFirst({
      where: {
        type: AccountType.SYSTEM_SETTLEMENT,
        status: AccountStatus.ACTIVE,
      },
    });

    if (!settlementAccount) {
      throw new BadRequestError(
        'System settlement account is not configured or inactive. Financial movement paused.'
      );
    }

    return settlementAccount;
  }

  // ============================================================================
  // DEPOSIT OPERATION
  // Double-Entry: Debit SYSTEM_SETTLEMENT (Bank Cash Asset +), Credit Customer Account (Liability +)
  // ============================================================================
  async deposit(input: DepositInput, ctx: TransactionServiceContext) {
    const endpoint = '/api/v1/transactions/deposit';
    const amountDecimal = new Prisma.Decimal(input.amount);

    return this.processWithIdempotency(
      input.idempotencyKey,
      endpoint,
      ctx,
      { accountId: input.accountId, amount: input.amount, description: input.description },
      async (tx, finalKey) => {
        // Fetch target account
        const account = await tx.account.findUnique({
          where: { id: input.accountId },
        });

        if (!account) {
          throw new NotFoundError('Target deposit account not found.');
        }

        // Ownership & Status Check
        if (ctx.userRole === Role.ACCOUNT_HOLDER && account.userId !== ctx.userId) {
          throw new ForbiddenError('You can only deposit funds into your own accounts.');
        }

        if (account.status !== AccountStatus.ACTIVE) {
          throw new BadRequestError(
            `Cannot deposit into account with status '${account.status}'. Account must be ACTIVE.`
          );
        }

        const settlementAccount = await this.getSystemSettlementAccount(tx);

        // Row-Level Locking (Deadlock-Free Order)
        await this.lockAccountsInOrder(tx, [account.id, settlementAccount.id]);

        // Calculate balances
        const targetNewBalance = account.balance.plus(amountDecimal);
        const settlementNewBalance = settlementAccount.balance.plus(amountDecimal);

        // Assert Double-Entry Equilibrium
        const totalDebits = amountDecimal;
        const totalCredits = amountDecimal;
        if (!totalDebits.equals(totalCredits)) {
          throw new Error('Ledger invariant failure: Total debits must equal total credits.');
        }

        // Create Ledger Transaction and balanced entries
        const transaction = await tx.ledgerTransaction.create({
          data: {
            idempotencyKey: finalKey,
            type: TransactionType.DEPOSIT,
            status: TransactionStatus.POSTED,
            description: input.description || `Deposit of $${amountDecimal.toFixed(4)}`,
            initiatedById: ctx.userId,
            entries: {
              create: [
                {
                  accountId: settlementAccount.id,
                  direction: LedgerDirection.DEBIT,
                  amount: amountDecimal,
                  balanceAfter: settlementNewBalance,
                },
                {
                  accountId: account.id,
                  direction: LedgerDirection.CREDIT,
                  amount: amountDecimal,
                  balanceAfter: targetNewBalance,
                },
              ],
            },
          },
          include: {
            entries: {
              include: {
                account: {
                  select: { id: true, accountNumber: true, type: true, status: true },
                },
              },
            },
          },
        });

        // Update account balances atomically
        await tx.account.update({
          where: { id: account.id },
          data: { balance: targetNewBalance },
        });

        await tx.account.update({
          where: { id: settlementAccount.id },
          data: { balance: settlementNewBalance },
        });

        // Audit Trail
        await recordAuditLog({
          action: 'DEPOSIT_EXECUTED',
          actorId: ctx.userId,
          actorRole: ctx.userRole,
          targetResource: 'TRANSACTION',
          targetId: transaction.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          metadata: {
            accountId: account.id,
            accountNumber: account.accountNumber,
            amount: amountDecimal.toString(),
            resultingBalance: targetNewBalance.toString(),
          },
        });

        return {
          transactionId: transaction.id,
          type: transaction.type,
          status: transaction.status,
          amount: amountDecimal.toString(),
          description: transaction.description,
          accountId: account.id,
          accountNumber: account.accountNumber,
          balanceAfter: targetNewBalance.toString(),
          createdAt: transaction.createdAt,
          entries: transaction.entries.map((e) => ({
            id: e.id,
            direction: e.direction,
            amount: e.amount.toString(),
            balanceAfter: e.balanceAfter.toString(),
            accountNumber: e.account.accountNumber,
          })),
        };
      }
    );
  }

  // ============================================================================
  // WITHDRAWAL OPERATION
  // Double-Entry: Debit Customer Account (Liability -), Credit SYSTEM_SETTLEMENT (Bank Cash Asset -)
  // ============================================================================
  async withdraw(input: WithdrawInput, ctx: TransactionServiceContext) {
    const endpoint = '/api/v1/transactions/withdraw';
    const amountDecimal = new Prisma.Decimal(input.amount);

    return this.processWithIdempotency(
      input.idempotencyKey,
      endpoint,
      ctx,
      { accountId: input.accountId, amount: input.amount, description: input.description },
      async (tx, finalKey) => {
        const account = await tx.account.findUnique({
          where: { id: input.accountId },
        });

        if (!account) {
          throw new NotFoundError('Withdrawal account not found.');
        }

        // Ownership & Status Check
        if (ctx.userRole === Role.ACCOUNT_HOLDER && account.userId !== ctx.userId) {
          throw new ForbiddenError('You can only withdraw funds from your own accounts.');
        }

        if (account.status !== AccountStatus.ACTIVE) {
          throw new BadRequestError(
            `Cannot withdraw from account with status '${account.status}'. Account must be ACTIVE.`
          );
        }

        const settlementAccount = await this.getSystemSettlementAccount(tx);

        // Lock accounts in deadlock-free order
        await this.lockAccountsInOrder(tx, [account.id, settlementAccount.id]);

        // Re-read account balance under row-lock to prevent concurrent overdrafts
        const lockedAccount = await tx.account.findUniqueOrThrow({
          where: { id: account.id },
        });

        // Strict Balance Integrity: Prevent negative balances
        if (lockedAccount.balance.lessThan(amountDecimal)) {
          throw new BadRequestError(
            `Insufficient funds. Available balance: $${lockedAccount.balance.toFixed(
              4
            )}, requested withdrawal: $${amountDecimal.toFixed(4)}.`
          );
        }

        const targetNewBalance = lockedAccount.balance.minus(amountDecimal);
        const settlementNewBalance = settlementAccount.balance.minus(amountDecimal);

        // Assert Double-Entry Equilibrium
        const totalDebits = amountDecimal;
        const totalCredits = amountDecimal;
        if (!totalDebits.equals(totalCredits)) {
          throw new Error('Ledger invariant failure: Total debits must equal total credits.');
        }

        // Create Ledger Transaction and balanced entries
        const transaction = await tx.ledgerTransaction.create({
          data: {
            idempotencyKey: finalKey,
            type: TransactionType.WITHDRAWAL,
            status: TransactionStatus.POSTED,
            description: input.description || `Withdrawal of $${amountDecimal.toFixed(4)}`,
            initiatedById: ctx.userId,
            entries: {
              create: [
                {
                  accountId: lockedAccount.id,
                  direction: LedgerDirection.DEBIT,
                  amount: amountDecimal,
                  balanceAfter: targetNewBalance,
                },
                {
                  accountId: settlementAccount.id,
                  direction: LedgerDirection.CREDIT,
                  amount: amountDecimal,
                  balanceAfter: settlementNewBalance,
                },
              ],
            },
          },
          include: {
            entries: {
              include: {
                account: {
                  select: { id: true, accountNumber: true, type: true, status: true },
                },
              },
            },
          },
        });

        // Update account balances
        await tx.account.update({
          where: { id: lockedAccount.id },
          data: { balance: targetNewBalance },
        });

        await tx.account.update({
          where: { id: settlementAccount.id },
          data: { balance: settlementNewBalance },
        });

        // Audit Trail
        await recordAuditLog({
          action: 'WITHDRAWAL_EXECUTED',
          actorId: ctx.userId,
          actorRole: ctx.userRole,
          targetResource: 'TRANSACTION',
          targetId: transaction.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          metadata: {
            accountId: lockedAccount.id,
            accountNumber: lockedAccount.accountNumber,
            amount: amountDecimal.toString(),
            resultingBalance: targetNewBalance.toString(),
          },
        });

        return {
          transactionId: transaction.id,
          type: transaction.type,
          status: transaction.status,
          amount: amountDecimal.toString(),
          description: transaction.description,
          accountId: lockedAccount.id,
          accountNumber: lockedAccount.accountNumber,
          balanceAfter: targetNewBalance.toString(),
          createdAt: transaction.createdAt,
          entries: transaction.entries.map((e) => ({
            id: e.id,
            direction: e.direction,
            amount: e.amount.toString(),
            balanceAfter: e.balanceAfter.toString(),
            accountNumber: e.account.accountNumber,
          })),
        };
      }
    );
  }

  // ============================================================================
  // TRANSFER OPERATION
  // Double-Entry: Debit Source Account (Balance -), Credit Destination Account (Balance +)
  // ============================================================================
  async transfer(input: TransferInput, ctx: TransactionServiceContext) {
    const endpoint = '/api/v1/transactions/transfer';
    const amountDecimal = new Prisma.Decimal(input.amount);

    return this.processWithIdempotency(
      input.idempotencyKey,
      endpoint,
      ctx,
      {
        sourceAccountId: input.sourceAccountId,
        destinationAccountId: input.destinationAccountId,
        destinationAccountNumber: input.destinationAccountNumber,
        amount: input.amount,
        description: input.description,
      },
      async (tx, finalKey) => {
        // 1. Locate Source Account
        const sourceAccount = await tx.account.findUnique({
          where: { id: input.sourceAccountId },
        });

        if (!sourceAccount) {
          throw new NotFoundError('Source account not found.');
        }

        // Ownership Check: User must own the source account
        if (ctx.userRole === Role.ACCOUNT_HOLDER && sourceAccount.userId !== ctx.userId) {
          throw new ForbiddenError('You can only transfer funds from your own account.');
        }

        if (sourceAccount.status !== AccountStatus.ACTIVE) {
          throw new BadRequestError(
            `Source account is not ACTIVE (current status: '${sourceAccount.status}').`
          );
        }

        // 2. Locate Destination Account (by Account Number or ID)
        let destinationAccount: Account | null = null;
        if (input.destinationAccountId) {
          destinationAccount = await tx.account.findUnique({
            where: { id: input.destinationAccountId },
          });
        } else if (input.destinationAccountNumber) {
          destinationAccount = await tx.account.findUnique({
            where: { accountNumber: input.destinationAccountNumber.trim() },
          });
        }

        if (!destinationAccount) {
          throw new NotFoundError('Destination account not found. Please verify the account number.');
        }

        // Prevent self-transfer to identical account
        if (sourceAccount.id === destinationAccount.id) {
          throw new BadRequestError(
            'Cannot transfer funds to the same account. Please choose a different destination.'
          );
        }

        // Destination status check
        if (destinationAccount.status !== AccountStatus.ACTIVE) {
          throw new BadRequestError(
            `Destination account is not ACTIVE (current status: '${destinationAccount.status}'). Transfers can only be made to ACTIVE accounts.`
          );
        }

        // Currency Match check
        if (sourceAccount.currency !== destinationAccount.currency) {
          throw new BadRequestError(
            `Currency mismatch: Source is in ${sourceAccount.currency}, but destination is in ${destinationAccount.currency}. Multi-currency conversion is not enabled.`
          );
        }

        // 3. Row-Level Locking in Sorted Order to prevent deadlocks
        await this.lockAccountsInOrder(tx, [sourceAccount.id, destinationAccount.id]);

        // Re-read source account under lock
        const lockedSource = await tx.account.findUniqueOrThrow({
          where: { id: sourceAccount.id },
        });

        // 4. Balance check
        if (lockedSource.balance.lessThan(amountDecimal)) {
          throw new BadRequestError(
            `Insufficient funds for transfer. Available balance: $${lockedSource.balance.toFixed(
              4
            )}, requested transfer: $${amountDecimal.toFixed(4)}.`
          );
        }

        const sourceNewBalance = lockedSource.balance.minus(amountDecimal);
        const destinationNewBalance = destinationAccount.balance.plus(amountDecimal);

        // Assert Double-Entry Equilibrium
        const totalDebits = amountDecimal;
        const totalCredits = amountDecimal;
        if (!totalDebits.equals(totalCredits)) {
          throw new Error('Ledger invariant failure: Total debits must equal total credits.');
        }

        // 5. Create Ledger Transaction and balanced entries
        const transaction = await tx.ledgerTransaction.create({
          data: {
            idempotencyKey: finalKey,
            type: TransactionType.TRANSFER,
            status: TransactionStatus.POSTED,
            description:
              input.description ||
              `Transfer of $${amountDecimal.toFixed(4)} to ${destinationAccount.accountNumber}`,
            initiatedById: ctx.userId,
            entries: {
              create: [
                {
                  accountId: lockedSource.id,
                  direction: LedgerDirection.DEBIT,
                  amount: amountDecimal,
                  balanceAfter: sourceNewBalance,
                },
                {
                  accountId: destinationAccount.id,
                  direction: LedgerDirection.CREDIT,
                  amount: amountDecimal,
                  balanceAfter: destinationNewBalance,
                },
              ],
            },
          },
          include: {
            entries: {
              include: {
                account: {
                  select: { id: true, accountNumber: true, type: true, status: true },
                },
              },
            },
          },
        });

        // 6. Update both accounts
        await tx.account.update({
          where: { id: lockedSource.id },
          data: { balance: sourceNewBalance },
        });

        await tx.account.update({
          where: { id: destinationAccount.id },
          data: { balance: destinationNewBalance },
        });

        // 7. Audit Trail
        await recordAuditLog({
          action: 'TRANSFER_EXECUTED',
          actorId: ctx.userId,
          actorRole: ctx.userRole,
          targetResource: 'TRANSACTION',
          targetId: transaction.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          metadata: {
            sourceAccountId: lockedSource.id,
            sourceAccountNumber: lockedSource.accountNumber,
            destinationAccountId: destinationAccount.id,
            destinationAccountNumber: destinationAccount.accountNumber,
            amount: amountDecimal.toString(),
            sourceResultingBalance: sourceNewBalance.toString(),
          },
        });

        return {
          transactionId: transaction.id,
          type: transaction.type,
          status: transaction.status,
          amount: amountDecimal.toString(),
          description: transaction.description,
          sourceAccountNumber: lockedSource.accountNumber,
          destinationAccountNumber: destinationAccount.accountNumber,
          sourceBalanceAfter: sourceNewBalance.toString(),
          createdAt: transaction.createdAt,
          entries: transaction.entries.map((e) => ({
            id: e.id,
            direction: e.direction,
            amount: e.amount.toString(),
            balanceAfter: e.balanceAfter.toString(),
            accountNumber: e.account.accountNumber,
          })),
        };
      }
    );
  }

  // ============================================================================
  // READ-ONLY / AUDIT QUERIES
  // ============================================================================

  /**
   * List transactions scoped to user role:
   * - ACCOUNT_HOLDER: only transactions touching accounts they own
   * - ADMIN / AUDITOR: all transactions
   */
  async listTransactions(ctx: TransactionServiceContext, accountId?: string) {
    const whereClause: Prisma.LedgerTransactionWhereInput = {};

    if (accountId) {
      // Check ownership if ACCOUNT_HOLDER
      if (ctx.userRole === Role.ACCOUNT_HOLDER) {
        const acc = await prisma.account.findUnique({ where: { id: accountId } });
        if (!acc || acc.userId !== ctx.userId) {
          throw new ForbiddenError('You can only view transactions for your own accounts.');
        }
      }
      whereClause.entries = {
        some: {
          accountId,
        },
      };
    } else if (ctx.userRole === Role.ACCOUNT_HOLDER) {
      // Return transactions touching any account owned by the user
      whereClause.entries = {
        some: {
          account: {
            userId: ctx.userId,
          },
        },
      };
    }

    const transactions = await prisma.ledgerTransaction.findMany({
      where: whereClause,
      include: {
        entries: {
          include: {
            account: {
              select: {
                id: true,
                accountNumber: true,
                type: true,
                status: true,
                userId: true,
                user: {
                  select: { fullName: true, email: true },
                },
              },
            },
          },
        },
        initiatedBy: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return transactions.map((tx) => ({
      id: tx.id,
      idempotencyKey: tx.idempotencyKey,
      type: tx.type,
      status: tx.status,
      description: tx.description,
      createdAt: tx.createdAt,
      initiatedBy: tx.initiatedBy,
      entries: tx.entries.map((e) => ({
        id: e.id,
        accountId: e.accountId,
        accountNumber: e.account.accountNumber,
        accountType: e.account.type,
        accountHolderName: e.account.user?.fullName,
        direction: e.direction,
        amount: e.amount.toString(),
        balanceAfter: e.balanceAfter.toString(),
      })),
    }));
  }

  /**
   * Get single transaction detail with double-entry ledger verification
   */
  async getTransactionById(transactionId: string, ctx: TransactionServiceContext) {
    const transaction = await prisma.ledgerTransaction.findUnique({
      where: { id: transactionId },
      include: {
        entries: {
          include: {
            account: {
              select: {
                id: true,
                accountNumber: true,
                type: true,
                status: true,
                userId: true,
                user: { select: { fullName: true, email: true } },
              },
            },
          },
        },
        initiatedBy: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction record not found.');
    }

    // Authorization: User must own at least one account involved, or be ADMIN/AUDITOR
    if (ctx.userRole === Role.ACCOUNT_HOLDER) {
      const ownsAnAccount = transaction.entries.some(
        (e) => e.account.userId === ctx.userId
      );
      if (!ownsAnAccount && transaction.initiatedById !== ctx.userId) {
        throw new ForbiddenError('You do not have permission to view this transaction.');
      }
    }

    // Verify mathematical double-entry equilibrium
    const debits = transaction.entries
      .filter((e) => e.direction === LedgerDirection.DEBIT)
      .reduce((sum, e) => sum.plus(e.amount), new Prisma.Decimal(0));

    const credits = transaction.entries
      .filter((e) => e.direction === LedgerDirection.CREDIT)
      .reduce((sum, e) => sum.plus(e.amount), new Prisma.Decimal(0));

    return {
      id: transaction.id,
      idempotencyKey: transaction.idempotencyKey,
      type: transaction.type,
      status: transaction.status,
      description: transaction.description,
      createdAt: transaction.createdAt,
      initiatedBy: transaction.initiatedBy,
      isBalanced: debits.equals(credits),
      totalDebits: debits.toString(),
      totalCredits: credits.toString(),
      entries: transaction.entries.map((e) => ({
        id: e.id,
        accountId: e.accountId,
        accountNumber: e.account.accountNumber,
        accountType: e.account.type,
        accountHolderName: e.account.user?.fullName,
        direction: e.direction,
        amount: e.amount.toString(),
        balanceAfter: e.balanceAfter.toString(),
      })),
    };
  }
}

export const transactionService = new TransactionService();
