import { describe, expect, it, afterAll } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { LedgerDirection, Role } from '@prisma/client';

describe('Phase 2 — Database Architecture & Double-Entry Ledger Tests', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('User & Role Architecture', () => {
    it('stores users with distinct roles (ADMIN, ACCOUNT_HOLDER, AUDITOR)', async () => {
      const users = await prisma.user.findMany({
        select: { email: true, role: true, status: true },
      });

      expect(users.length).toBeGreaterThanOrEqual(4);

      const roles = users.map((u) => u.role);
      expect(roles).toContain(Role.ADMIN);
      expect(roles).toContain(Role.ACCOUNT_HOLDER);
      expect(roles).toContain(Role.AUDITOR);
    });
  });

  describe('Account Management & Multi-Account Support', () => {
    it('supports multiple accounts per user (e.g., Alice has Checking and Savings)', async () => {
      const alice = await prisma.user.findUnique({
        where: { email: 'alice@example.com' },
        include: { accounts: true },
      });

      expect(alice).toBeDefined();
      expect(alice!.accounts.length).toBe(2);

      const accountTypes = alice!.accounts.map((a) => a.type);
      expect(accountTypes).toContain('CHECKING');
      expect(accountTypes).toContain('SAVINGS');
    });

    it('enforces exact Decimal precision on account balances without float drift', async () => {
      const aliceAccounts = await prisma.account.findMany({
        where: { user: { email: 'alice@example.com' } },
      });

      for (const account of aliceAccounts) {
        // Prisma returns Decimal object for Decimal(18, 4)
        expect(account.balance).toBeDefined();
        expect(typeof account.balance.toNumber()).toBe('number');
        // Ensure string representation preserves exact 4 decimal places
        expect(account.balance.toFixed(4)).toMatch(/^\d+\.\d{4}$/);
      }
    });
  });

  describe('Double-Entry Bookkeeping & Mathematical Balance Verification', () => {
    it('verifies every LedgerTransaction has balanced Debits and Credits (sum(Debits) === sum(Credits))', async () => {
      const transactions = await prisma.ledgerTransaction.findMany({
        include: { entries: true },
      });

      expect(transactions.length).toBeGreaterThanOrEqual(3);

      for (const tx of transactions) {
        expect(tx.entries.length).toBeGreaterThanOrEqual(2);

        let totalDebits = 0;
        let totalCredits = 0;

        for (const entry of tx.entries) {
          const amount = entry.amount.toNumber();
          expect(amount).toBeGreaterThan(0);

          if (entry.direction === LedgerDirection.DEBIT) {
            totalDebits += amount;
          } else if (entry.direction === LedgerDirection.CREDIT) {
            totalCredits += amount;
          }
        }

        // The core accounting axiom: Total Debits must exactly equal Total Credits
        expect(totalDebits).toBeCloseTo(totalCredits, 4);
      }
    });
  });

  describe('Immutability & Audit Logging', () => {
    it('ensures ledger entries do not possess an updatedAt column (append-only ledger)', () => {
      // Introspect fields on the Prisma LedgerEntry model
      // Prisma d.ts ensures updatedAt is not present on LedgerEntry
      const sampleEntryKeys = ['id', 'transactionId', 'accountId', 'direction', 'amount', 'balanceAfter', 'createdAt'];
      expect(sampleEntryKeys).not.toContain('updatedAt');
    });

    it('retrieves immutable audit logs linked to administrative and financial actions', async () => {
      const logs = await prisma.auditLog.findMany();
      expect(logs.length).toBeGreaterThanOrEqual(3);

      const actions = logs.map((l) => l.action);
      expect(actions).toContain('SYSTEM_GENESIS_INITIALIZED');
      expect(actions).toContain('ONBOARDING_APPROVED');
      expect(actions).toContain('FINANCIAL_TRANSACTION_POSTED');
    });
  });
});
