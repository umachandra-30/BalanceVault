import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Phase 8 — Audit Logging & Transaction History Tests', () => {
  const app = createApp();

  let adminToken = '';
  let auditorToken = '';
  let aliceToken = '';
  let bobToken = '';
  let aliceUserId = '';
  let bobUserId = '';
  let aliceCheckingId = '';
  let bobCheckingId = '';

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

    const aliceAcc = await prisma.account.findFirstOrThrow({
      where: { user: { email: 'alice@example.com' }, type: 'CHECKING' },
    });
    aliceCheckingId = aliceAcc.id;

    const bobAcc = await prisma.account.findFirstOrThrow({
      where: { user: { email: 'bob@example.com' }, type: 'CHECKING' },
    });
    bobCheckingId = bobAcc.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ============================================================================
  // 1. ROLE-BASED ACCESS CONTROL FOR AUDIT LOGS
  // ============================================================================
  describe('1. Audit Log Access Control', () => {
    it('blocks regular ACCOUNT_HOLDER (Alice) from viewing audit logs (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('is not authorized');
    });

    it('blocks unauthenticated requests from accessing audit logs (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/v1/audit-logs');
      expect(res.status).toBe(401);
    });

    it('allows ADMIN to access paginated audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.totalCount).toBeGreaterThanOrEqual(1);
    });

    it('allows AUDITOR to access audit logs in read-only mode', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${auditorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('allows ADMIN and AUDITOR to retrieve audit statistics', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs/stats')
        .set('Authorization', `Bearer ${auditorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalCount).toBeGreaterThan(0);
      expect(typeof res.body.data.failureCount).toBe('number');
      expect(typeof res.body.data.financialCount).toBe('number');
      expect(typeof res.body.data.adminCount).toBe('number');
    });
  });

  // ============================================================================
  // 2. AUDIT RECORD GENERATION FOR CRITICAL EVENTS
  // ============================================================================
  describe('2. Audit Record Creation Across Lifecycle Events', () => {
    it('records an audit entry when a login failure occurs due to incorrect password', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'alice@example.com', password: 'WrongPassword999!' });

      const log = await prisma.auditLog.findFirst({
        where: { action: 'LOGIN_FAILED', targetId: aliceUserId },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
      expect(log!.action).toBe('LOGIN_FAILED');
    });

    it('records an audit entry with outcome DENIED when an authorization check fails', async () => {
      // Alice tries to access Bob's account details
      await request(app)
        .get(`/api/v1/accounts/${bobCheckingId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      const log = await prisma.auditLog.findFirst({
        where: {
          action: 'AUTHORIZATION_FAILURE',
          actorId: aliceUserId,
          targetId: bobCheckingId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
      expect(log!.outcome).toBe('DENIED');
      expect(log!.targetResource).toBe('ACCOUNT');
    });

    it('records an audit entry when a financial deposit is performed', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/deposit')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          accountId: aliceCheckingId,
          amount: '12.5000',
          description: 'Audit Test Deposit',
        });

      expect(res.status).toBe(201);
      const txId = res.body.data.transactionId;

      const log = await prisma.auditLog.findFirst({
        where: { action: 'DEPOSIT_EXECUTED', targetId: txId },
      });

      expect(log).toBeDefined();
      expect(log!.actorId).toBe(aliceUserId);
      expect(log!.outcome).toBe('SUCCESS');
    });
  });

  // ============================================================================
  // 3. SENSITIVE DATA PROTECTION
  // ============================================================================
  describe('3. Sensitive Data Sanitization in Audit Records', () => {
    it('never logs passwords, hashes, or bearer tokens in audit metadata', async () => {
      const allLogs = await prisma.auditLog.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
      });

      for (const log of allLogs) {
        const metadataStr = JSON.stringify(log.metadata || {});
        // Must never contain raw passwords or token secrets
        expect(metadataStr).not.toContain('DemoPass123!');
        expect(metadataStr).not.toContain('WrongPassword999!');
        expect(metadataStr).not.toContain('passwordHash');
        expect(metadataStr).not.toContain('Bearer ');
      }
    });
  });

  // ============================================================================
  // 4. SEARCH, FILTERING & PAGINATION
  // ============================================================================
  describe('4. Search, Filtering & Pagination on Audit Logs', () => {
    it('filters audit records by action', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?action=USER_LOGGED_IN')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data) {
        expect(item.action).toBe('USER_LOGGED_IN');
      }
    });

    it('filters audit records by outcome (e.g. DENIED)', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?outcome=DENIED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data) {
        expect(item.outcome).toBe('DENIED');
      }
    });

    it('paginates audit records correctly with page and limit parameters', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('searches audit records by keyword across actor email or action', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?search=alice')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      const matches = res.body.data.every(
        (item: any) =>
          item.actor?.email?.includes('alice') ||
          item.actor?.fullName?.toLowerCase().includes('alice') ||
          JSON.stringify(item.metadata).toLowerCase().includes('alice')
      );
      expect(matches).toBe(true);
    });
  });

  // ============================================================================
  // 5. TRANSACTION HISTORY SCOPING & PERMISSIONS
  // ============================================================================
  describe('5. Transaction History Scoped Access', () => {
    it('returns only owned transactions for an ACCOUNT_HOLDER (Alice)', async () => {
      const res = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();

      // Every transaction returned must touch Alice's account or be initiated by Alice
      for (const tx of res.body.data) {
        const touchesAliceAccount = tx.entries.some(
          (e: any) => e.accountId === aliceCheckingId || tx.initiatedBy?.id === aliceUserId
        );
        expect(touchesAliceAccount).toBe(true);
      }
    });

    it('blocks Alice from accessing transaction history for Bob account (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/transactions?accountId=${bobCheckingId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('only view transactions for your own accounts');
    });
  });
});

