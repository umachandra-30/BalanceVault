import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Phase 6 — Account Management & Access Control Tests', () => {
  const app = createApp();

  let adminToken = '';
  let auditorToken = '';
  let aliceToken = '';
  let bobToken = '';
  let aliceAccountId = '';
  let createdSavingsAccountId = '';

  beforeAll(async () => {
    // 1. Authenticate seeded users
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

    const bobRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob@example.com', password: 'DemoPass123!' });
    bobToken = bobRes.body.data.accessToken;

    // 2. Locate Alice Checking Account
    const aliceAccount = await prisma.account.findFirst({
      where: { user: { email: 'alice@example.com' }, type: 'CHECKING' },
    });
    aliceAccountId = aliceAccount!.id;
  });

  afterAll(async () => {
    // Clean up created savings account
    if (createdSavingsAccountId) {
      await prisma.account.delete({ where: { id: createdSavingsAccountId } });
    }
    await prisma.$disconnect();
  });

  describe('Account Creation for Approved Users', () => {
    it('allows an ACTIVE user (Alice) to open a new SAVINGS account with unique identifier', async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          type: 'SAVINGS',
          currency: 'USD',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('SAVINGS');
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.accountNumber).toMatch(/^BV-\d+$/);
      expect(Number(res.body.data.balance)).toBe(0);

      createdSavingsAccountId = res.body.data.id;

      // Verify audit log was recorded
      const log = await prisma.auditLog.findFirst({
        where: { action: 'ACCOUNT_CREATED', targetId: createdSavingsAccountId },
      });
      expect(log).toBeDefined();
    });

    it('blocks a non-approved PENDING_ONBOARDING user (Bob) from opening an account (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          type: 'CHECKING',
          currency: 'USD',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('onboarding must be APPROVED');
    });

    it('rejects creation of unauthorized account types like SYSTEM_SETTLEMENT (422 Validation Error)', async () => {
      const res = await request(app)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          type: 'SYSTEM_SETTLEMENT',
          currency: 'USD',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Account Listing & Scoped Views', () => {
    it('returns only owned accounts when an ACCOUNT_HOLDER lists accounts', async () => {
      const res = await request(app)
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      // Alice owns at least 2 accounts (Checking and newly created Savings)
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      for (const account of res.body.data) {
        expect(account.passwordHash).toBeUndefined();
      }
    });

    it('allows AUDITOR to view platform-wide accounts in read-only mode', async () => {
      const res = await request(app)
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${auditorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Auditor sees accounts belonging to Alice, Bob, and System Settlement
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Account Details & Balance API with Ownership Validation', () => {
    it("allows Alice to inspect her own account details and balance", async () => {
      const detailsRes = await request(app)
        .get(`/api/v1/accounts/${aliceAccountId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(detailsRes.status).toBe(200);
      expect(detailsRes.body.success).toBe(true);
      expect(detailsRes.body.data.id).toBe(aliceAccountId);
      expect(detailsRes.body.data.user.email).toBe('alice@example.com');
      // Verify sensitive passwordHash is never leaked
      expect(detailsRes.body.data.user.passwordHash).toBeUndefined();

      const balanceRes = await request(app)
        .get(`/api/v1/accounts/${aliceAccountId}/balance`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(balanceRes.status).toBe(200);
      expect(balanceRes.body.success).toBe(true);
      expect(balanceRes.body.data.accountId).toBe(aliceAccountId);
      expect(balanceRes.body.data.balance).toBeDefined();
      expect(balanceRes.body.data.status).toBe('ACTIVE');
    });

    it("prevents Bob from viewing Alice's account details or balance (403 Forbidden)", async () => {
      const detailsRes = await request(app)
        .get(`/api/v1/accounts/${aliceAccountId}`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(detailsRes.status).toBe(403);
      expect(detailsRes.body.error.code).toBe('FORBIDDEN');
      expect(detailsRes.body.error.message).toContain('Access denied');

      const balanceRes = await request(app)
        .get(`/api/v1/accounts/${aliceAccountId}/balance`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(balanceRes.status).toBe(403);
      expect(balanceRes.body.error.code).toBe('FORBIDDEN');
    });

    it("allows AUDITOR to view Alice's balance in read-only mode", async () => {
      const balanceRes = await request(app)
        .get(`/api/v1/accounts/${aliceAccountId}/balance`)
        .set('Authorization', `Bearer ${auditorToken}`);

      expect(balanceRes.status).toBe(200);
      expect(balanceRes.body.data.accountId).toBe(aliceAccountId);
    });
  });

  describe('Administrative Account Status Management', () => {
    it('allows ADMIN to freeze an account with a stated reason', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/accounts/${aliceAccountId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'FROZEN',
          reason: 'Compliance audit security hold on account.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('FROZEN');

      // Verify balance endpoint reflects FROZEN status
      const balanceRes = await request(app)
        .get(`/api/v1/accounts/${aliceAccountId}/balance`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(balanceRes.body.data.status).toBe('FROZEN');

      // Verify audit log
      const log = await prisma.auditLog.findFirst({
        where: { action: 'ACCOUNT_STATUS_UPDATED', targetId: aliceAccountId },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toBeDefined();
      expect(JSON.stringify(log!.metadata)).toContain('FROZEN');
    });

    it('blocks regular users from modifying account status (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/accounts/${aliceAccountId}/status`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          status: 'ACTIVE',
          reason: 'Attempting self-unfreeze',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows ADMIN to unfreeze the account back to ACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/accounts/${aliceAccountId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'ACTIVE',
          reason: 'Compliance verification completed; hold lifted.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });
  });
});
