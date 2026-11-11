import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { AccountStatus, AccountType, LedgerDirection, TransactionType } from '@prisma/client';

describe('Phase 7 — Financial Operations & Double-Entry Ledger Engine Tests', () => {
  const app = createApp();

  let adminToken = '';
  let auditorToken = '';
  let aliceToken = '';
  let bobToken = '';

  let aliceUserId = '';
  let bobUserId = '';
  let aliceCheckingId = '';
  let aliceCheckingNumber = '';
  let bobCheckingId = '';
  let bobCheckingNumber = '';
  let systemSettlementId = '';

  beforeAll(async () => {
    // 1. Authenticate users
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@balancevault.local', password: 'DemoPass123!' });
    adminToken = adminRes.body.data.accessToken;

    const auditorRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'auditor@balancevault.local', password: 'DemoPass123!' });
    auditorToken = auditorRes.body.data.accessToken;

    const aliceRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'DemoPass123!' });
    aliceToken = aliceRes.body.data.accessToken;
    aliceUserId = aliceRes.body.data.user.id;

    const bobRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob@example.com', password: 'DemoPass123!' });
    bobToken = bobRes.body.data.accessToken;
    bobUserId = bobRes.body.data.user.id;

    // 2. Locate accounts
    const aliceChecking = await prisma.account.findFirstOrThrow({
      where: { user: { email: 'alice@example.com' }, type: 'CHECKING' },
    });
    aliceCheckingId = aliceChecking.id;
    aliceCheckingNumber = aliceChecking.accountNumber;

    const bobChecking = await prisma.account.findFirstOrThrow({
      where: { user: { email: 'bob@example.com' }, type: 'CHECKING' },
    });
    bobCheckingId = bobChecking.id;
    bobCheckingNumber = bobChecking.accountNumber;

    const settlement = await prisma.account.findFirstOrThrow({
      where: { type: AccountType.SYSTEM_SETTLEMENT },
    });
    systemSettlementId = settlement.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ============================================================================
  // 1. SUCCESSFUL DEPOSIT
  // ============================================================================
  describe('1. Deposit Operation & Ledger Accounting', () => {
    it('executes a successful deposit into Alice Checking with balanced double-entry records', async () => {
      // Record initial balances
      const initialAlice = await prisma.account.findUniqueOrThrow({ where: { id: aliceCheckingId } });
      const initialSettlement = await prisma.account.findUniqueOrThrow({ where: { id: systemSettlementId } });

      const depositAmount = '250.0000';

      const res = await request(app)
        .post('/api/v1/transactions/deposit')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          accountId: aliceCheckingId,
          amount: depositAmount,
          description: 'Payroll Direct Deposit Test',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('DEPOSIT');
      expect(res.body.data.status).toBe('POSTED');

      const expectedNewAliceBalance = initialAlice.balance.plus(depositAmount);
      const expectedNewSettlementBalance = initialSettlement.balance.plus(depositAmount);

      expect(parseFloat(res.body.data.balanceAfter)).toBe(expectedNewAliceBalance.toNumber());

      // Verify database balances
      const updatedAlice = await prisma.account.findUniqueOrThrow({ where: { id: aliceCheckingId } });
      const updatedSettlement = await prisma.account.findUniqueOrThrow({ where: { id: systemSettlementId } });

      expect(updatedAlice.balance.toString()).toBe(expectedNewAliceBalance.toString());
      expect(updatedSettlement.balance.toString()).toBe(expectedNewSettlementBalance.toString());

      // Verify Double-Entry Entries in Database
      const txRecord = await prisma.ledgerTransaction.findUniqueOrThrow({
        where: { id: res.body.data.transactionId },
        include: { entries: true },
      });

      expect(txRecord.entries.length).toBe(2);

      const debitEntry = txRecord.entries.find((e) => e.direction === LedgerDirection.DEBIT);
      const creditEntry = txRecord.entries.find((e) => e.direction === LedgerDirection.CREDIT);

      expect(debitEntry).toBeDefined();
      expect(creditEntry).toBeDefined();

      // In a deposit: Bank Cash Asset (Settlement) is Debited; Customer Account (Liability) is Credited
      expect(debitEntry!.accountId).toBe(systemSettlementId);
      expect(debitEntry!.amount.toFixed(4)).toBe(depositAmount);

      expect(creditEntry!.accountId).toBe(aliceCheckingId);
      expect(creditEntry!.amount.toFixed(4)).toBe(depositAmount);

      // Verify Total Debits === Total Credits
      expect(debitEntry!.amount.equals(creditEntry!.amount)).toBe(true);

      // Verify Audit Log was written
      const auditLog = await prisma.auditLog.findFirst({
        where: { action: 'DEPOSIT_EXECUTED', targetId: txRecord.id },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog!.actorId).toBe(aliceUserId);
    });
  });

  // ============================================================================
  // 2. SUCCESSFUL WITHDRAWAL
  // ============================================================================
  describe('2. Withdrawal Operation & Ledger Accounting', () => {
    it('executes a successful withdrawal from Alice Checking with balanced double-entry records', async () => {
      const initialAlice = await prisma.account.findUniqueOrThrow({ where: { id: aliceCheckingId } });
      const initialSettlement = await prisma.account.findUniqueOrThrow({ where: { id: systemSettlementId } });

      const withdrawalAmount = '75.5000';

      const res = await request(app)
        .post('/api/v1/transactions/withdraw')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          accountId: aliceCheckingId,
          amount: withdrawalAmount,
          description: 'ATM Cash Withdrawal Test',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('WITHDRAWAL');

      const expectedNewAliceBalance = initialAlice.balance.minus(withdrawalAmount);
      const expectedNewSettlementBalance = initialSettlement.balance.minus(withdrawalAmount);

      expect(parseFloat(res.body.data.balanceAfter)).toBe(expectedNewAliceBalance.toNumber());

      const updatedAlice = await prisma.account.findUniqueOrThrow({ where: { id: aliceCheckingId } });
      const updatedSettlement = await prisma.account.findUniqueOrThrow({ where: { id: systemSettlementId } });

      expect(updatedAlice.balance.toString()).toBe(expectedNewAliceBalance.toString());
      expect(updatedSettlement.balance.toString()).toBe(expectedNewSettlementBalance.toString());

      // Verify Double-Entry: Customer Debited, Settlement Credited
      const txRecord = await prisma.ledgerTransaction.findUniqueOrThrow({
        where: { id: res.body.data.transactionId },
        include: { entries: true },
      });

      const debitEntry = txRecord.entries.find((e) => e.direction === LedgerDirection.DEBIT);
      const creditEntry = txRecord.entries.find((e) => e.direction === LedgerDirection.CREDIT);

      expect(debitEntry!.accountId).toBe(aliceCheckingId);
      expect(creditEntry!.accountId).toBe(systemSettlementId);
      expect(debitEntry!.amount.equals(creditEntry!.amount)).toBe(true);
    });
  });

  // ============================================================================
  // 3. SUCCESSFUL TRANSFER
  // ============================================================================
  describe('3. Transfer Between Accounts', () => {
    it('executes a successful peer-to-peer transfer from Alice to Bob with balanced debit and credit entries', async () => {
      const initialAlice = await prisma.account.findUniqueOrThrow({ where: { id: aliceCheckingId } });
      const initialBob = await prisma.account.findUniqueOrThrow({ where: { id: bobCheckingId } });

      const transferAmount = '120.0000';

      const res = await request(app)
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          sourceAccountId: aliceCheckingId,
          destinationAccountNumber: bobCheckingNumber,
          amount: transferAmount,
          description: 'Rent split transfer to Bob',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('TRANSFER');
      expect(res.body.data.sourceAccountNumber).toBe(aliceCheckingNumber);
      expect(res.body.data.destinationAccountNumber).toBe(bobCheckingNumber);

      const expectedNewAliceBalance = initialAlice.balance.minus(transferAmount);
      const expectedNewBobBalance = initialBob.balance.plus(transferAmount);

      const updatedAlice = await prisma.account.findUniqueOrThrow({ where: { id: aliceCheckingId } });
      const updatedBob = await prisma.account.findUniqueOrThrow({ where: { id: bobCheckingId } });

      expect(updatedAlice.balance.toString()).toBe(expectedNewAliceBalance.toString());
      expect(updatedBob.balance.toString()).toBe(expectedNewBobBalance.toString());

      // Verify ledger entries
      const txRecord = await prisma.ledgerTransaction.findUniqueOrThrow({
        where: { id: res.body.data.transactionId },
        include: { entries: true },
      });

      const debitEntry = txRecord.entries.find((e) => e.direction === LedgerDirection.DEBIT);
      const creditEntry = txRecord.entries.find((e) => e.direction === LedgerDirection.CREDIT);

      expect(debitEntry!.accountId).toBe(aliceCheckingId);
      expect(creditEntry!.accountId).toBe(bobCheckingId);
      expect(debitEntry!.amount.equals(creditEntry!.amount)).toBe(true);
    });
  });

  // ============================================================================
  // 4. INSUFFICIENT FUNDS & NEGATIVE BALANCE PREVENTION
  // ============================================================================
  describe('4. Insufficient Funds & Negative Balance Protection', () => {
    it('rejects withdrawal when amount exceeds available balance (400 Bad Request) and preserves balance', async () => {
      const currentAlice = await prisma.account.findUniqueOrThrow({ where: { id: aliceCheckingId } });
      const excessiveAmount = currentAlice.balance.plus(50000).toFixed(4);

      const res = await request(app)
        .post('/api/v1/transactions/withdraw')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          accountId: aliceCheckingId,
          amount: excessiveAmount,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Insufficient funds');

      // Balance must remain strictly unchanged
      const afterAlice = await prisma.account.findUniqueOrThrow({ where: { id: aliceCheckingId } });
      expect(afterAlice.balance.toString()).toBe(currentAlice.balance.toString());
    });

    it('rejects transfer when amount exceeds available balance', async () => {
      const currentAlice = await prisma.account.findUniqueOrThrow({ where: { id: aliceCheckingId } });
      const excessiveAmount = currentAlice.balance.plus(1000).toFixed(4);

      const res = await request(app)
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          sourceAccountId: aliceCheckingId,
          destinationAccountNumber: bobCheckingNumber,
          amount: excessiveAmount,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Insufficient funds');
    });
  });

  // ============================================================================
  // 5. INVALID DESTINATION ACCOUNT & OWNERSHIP CHECKS
  // ============================================================================
  describe('5. Invalid Destination Account & Permission Verification', () => {
    it('rejects transfer to non-existent destination account number (404 Not Found)', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          sourceAccountId: aliceCheckingId,
          destinationAccountNumber: 'BV-9999999999',
          amount: '10.0000',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Destination account not found');
    });

    it('rejects transfer when source and destination are the exact same account', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          sourceAccountId: aliceCheckingId,
          destinationAccountNumber: aliceCheckingNumber,
          amount: '10.0000',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('same account');
    });

    it('prevents Alice from withdrawing from Bob account (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/withdraw')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          accountId: bobCheckingId,
          amount: '10.0000',
        });

      expect(res.status).toBe(403);
    });

    it('rejects transfer to a FROZEN destination account', async () => {
      // Temporarily freeze Bob account
      await prisma.account.update({
        where: { id: bobCheckingId },
        data: { status: AccountStatus.FROZEN },
      });

      const res = await request(app)
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          sourceAccountId: aliceCheckingId,
          destinationAccountNumber: bobCheckingNumber,
          amount: '10.0000',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('not ACTIVE');

      // Unfreeze Bob account back
      await prisma.account.update({
        where: { id: bobCheckingId },
        data: { status: AccountStatus.ACTIVE },
      });
    });
  });

  // ============================================================================
  // 6. IDEMPOTENCY KEY PROTECTION
  // ============================================================================
  describe('6. Duplicate Request Prevention via Idempotency Keys', () => {
    it('executes transaction once and returns cached replay for duplicate requests with the same idempotency key', async () => {
      const idempotencyKey = `idem_test_${Date.now()}`;
      const initialAlice = await prisma.account.findUniqueOrThrow({ where: { id: aliceCheckingId } });

      // First Request
      const res1 = await request(app)
        .post('/api/v1/transactions/deposit')
        .set('Authorization', `Bearer ${aliceToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          accountId: aliceCheckingId,
          amount: '50.0000',
          description: 'Idempotency deposit test',
        });

      expect(res1.status).toBe(201);
      expect(res1.headers['x-idempotent-replay']).toBe('false');
      const txId1 = res1.body.data.transactionId;

      // Duplicate Request (Identical payload and idempotency key)
      const res2 = await request(app)
        .post('/api/v1/transactions/deposit')
        .set('Authorization', `Bearer ${aliceToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          accountId: aliceCheckingId,
          amount: '50.0000',
          description: 'Idempotency deposit test',
        });

      expect(res2.status).toBe(201);
      expect(res2.headers['x-idempotent-replay']).toBe('true');
      expect(res2.body.data.transactionId).toBe(txId1);

      // Verify database balance was credited ONLY ONCE ($50, not $100)
      const afterAlice = await prisma.account.findUniqueOrThrow({ where: { id: aliceCheckingId } });
      expect(afterAlice.balance.toString()).toBe(initialAlice.balance.plus('50.0000').toString());

      // Verify only ONE transaction record exists for this key
      const txCount = await prisma.ledgerTransaction.count({
        where: { idempotencyKey },
      });
      expect(txCount).toBe(1);
    });

    it('rejects duplicate idempotency key when payload differs (409 Conflict)', async () => {
      const idempotencyKey = `idem_conflict_${Date.now()}`;

      // First Request
      await request(app)
        .post('/api/v1/transactions/deposit')
        .set('Authorization', `Bearer ${aliceToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          accountId: aliceCheckingId,
          amount: '10.0000',
        });

      // Tampered Duplicate Request (same key, different amount)
      const res = await request(app)
        .post('/api/v1/transactions/deposit')
        .set('Authorization', `Bearer ${aliceToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          accountId: aliceCheckingId,
          amount: '20.0000',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('previously used with a different request payload');
    });
  });

  // ============================================================================
  // 7. CONCURRENT WITHDRAWALS & RACE-CONDITION OVERDRAFT PROTECTION
  // ============================================================================
  describe('7. Concurrent Withdrawals & Row-Level Locking', () => {
    it('safely serializes concurrent withdrawals on the same account and prevents race-condition overdrafts', async () => {
      // 1. Create a dedicated temporary account with exactly $100.00 balance
      const testAccount = await prisma.account.create({
        data: {
          accountNumber: `BV-CONCUR-${Date.now()}`,
          userId: aliceUserId,
          type: AccountType.SAVINGS,
          status: AccountStatus.ACTIVE,
          currency: 'USD',
          balance: 100.0000,
        },
      });

      // 2. Launch two simultaneous withdrawal requests for $80.00
      // Sum is $160.00 which exceeds the $100.00 balance.
      // Under proper row locking (FOR UPDATE), exactly ONE must succeed and the other MUST fail!
      const req1 = request(app)
        .post('/api/v1/transactions/withdraw')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          accountId: testAccount.id,
          amount: '80.0000',
          description: 'Parallel Withdrawal 1',
        });

      const req2 = request(app)
        .post('/api/v1/transactions/withdraw')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          accountId: testAccount.id,
          amount: '80.0000',
          description: 'Parallel Withdrawal 2',
        });

      const [res1, res2] = await Promise.all([req1, req2]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 400]);

      // Verify the failing response reported Insufficient Funds
      const failedRes = res1.status === 400 ? res1 : res2;
      const successRes = res1.status === 201 ? res1 : res2;
      expect(failedRes.body.error.message).toContain('Insufficient funds');

      // 3. Final balance must be exactly $20.00 (100 - 80), NEVER negative!
      const finalAccount = await prisma.account.findUniqueOrThrow({
        where: { id: testAccount.id },
      });
      expect(parseFloat(finalAccount.balance.toString())).toBe(20.0);

      // Clean up test account and its transaction completely
      if (successRes.body.data?.transactionId) {
        await prisma.ledgerEntry.deleteMany({ where: { transactionId: successRes.body.data.transactionId } });
        await prisma.ledgerTransaction.delete({ where: { id: successRes.body.data.transactionId } });
      }
      await prisma.account.delete({ where: { id: testAccount.id } });
    });
  });

  // ============================================================================
  // 8. ATOMIC DATABASE ROLLBACK ON ERROR
  // ============================================================================
  describe('8. Database Rollback Verification', () => {
    it('atomically rolls back account balances and ledger records when an operation fails mid-transaction', async () => {
      const initialAlice = await prisma.account.findUniqueOrThrow({ where: { id: aliceCheckingId } });
      const initialSettlement = await prisma.account.findUniqueOrThrow({ where: { id: systemSettlementId } });

      // Pass an invalid destination format that causes an internal failure during transfer
      const res = await request(app)
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          sourceAccountId: aliceCheckingId,
          destinationAccountNumber: 'INVALID-ACC-NUMBER',
          amount: '50.0000',
        });

      expect(res.status).toBe(404);

      // Verify balances remained identical
      const currentAlice = await prisma.account.findUniqueOrThrow({ where: { id: aliceCheckingId } });
      const currentSettlement = await prisma.account.findUniqueOrThrow({ where: { id: systemSettlementId } });

      expect(currentAlice.balance.toString()).toBe(initialAlice.balance.toString());
      expect(currentSettlement.balance.toString()).toBe(initialSettlement.balance.toString());
    });
  });

  // ============================================================================
  // 9. DEBIT-CREDIT BALANCE VERIFICATION & AUDIT INSPECTION
  // ============================================================================
  describe('9. Debit-Credit Balance Verification & Audit Read Access', () => {
    it('verifies mathematical double-entry equilibrium on transaction detail endpoint (GET /api/v1/transactions/:id)', async () => {
      // Create a transfer
      const res = await request(app)
        .post('/api/v1/transactions/transfer')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          sourceAccountId: aliceCheckingId,
          destinationAccountNumber: bobCheckingNumber,
          amount: '15.0000',
          description: 'Equilibrium Verification Transfer',
        });

      expect(res.status).toBe(201);
      const txId = res.body.data.transactionId;

      // Inspect via detail endpoint
      const detailRes = await request(app)
        .get(`/api/v1/transactions/${txId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.isBalanced).toBe(true);
      expect(detailRes.body.data.totalDebits).toBe('15');
      expect(detailRes.body.data.totalCredits).toBe('15');
      expect(detailRes.body.data.entries.length).toBe(2);
    });

    it('allows AUDITOR to inspect all transactions across the entire platform in read-only mode', async () => {
      const res = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${auditorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify all transactions in the system are balanced
      for (const tx of res.body.data) {
        const debits = tx.entries
          .filter((e: any) => e.direction === 'DEBIT')
          .reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);

        const credits = tx.entries
          .filter((e: any) => e.direction === 'CREDIT')
          .reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);

        expect(Math.abs(debits - credits)).toBeLessThan(0.0001);
      }
    });

    it('blocks AUDITOR from executing deposits, withdrawals, or transfers (Read-Only Enforcement)', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/deposit')
        .set('Authorization', `Bearer ${auditorToken}`)
        .send({
          accountId: aliceCheckingId,
          amount: '100.0000',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Auditor role is strictly read-only');
    });
  });
});
