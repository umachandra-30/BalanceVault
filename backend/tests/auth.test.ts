import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Phase 3 — Authentication, Authorization & Account Ownership Tests', () => {
  const app = createApp();

  // Test credentials
  const testUser = {
    email: `test_${Date.now()}@example.com`,
    password: 'ValidPassword123!',
    fullName: 'Test Account Holder',
  };

  let testUserToken = '';
  let testUserId = '';
  let aliceToken = '';
  let bobToken = '';
  let adminToken = '';
  let auditorToken = '';
  let aliceAccountId = '';
  let bobAccountId = '';

  beforeAll(async () => {
    // 1. Authenticate seeded Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@balancevault.local', password: 'DemoPass123!' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.accessToken;

    // 2. Authenticate seeded Auditor
    const auditorRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'auditor@balancevault.local', password: 'DemoPass123!' });
    expect(auditorRes.status).toBe(200);
    auditorToken = auditorRes.body.data.accessToken;

    // 3. Authenticate seeded Alice
    const aliceRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'DemoPass123!' });
    expect(aliceRes.status).toBe(200);
    aliceToken = aliceRes.body.data.accessToken;

    // 4. Authenticate seeded Bob
    const bobRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob@example.com', password: 'DemoPass123!' });
    expect(bobRes.status).toBe(200);
    bobToken = bobRes.body.data.accessToken;

    // 5. Look up account IDs
    const aliceAccount = await prisma.account.findFirst({
      where: { user: { email: 'alice@example.com' } },
    });
    aliceAccountId = aliceAccount!.id;

    const bobAccount = await prisma.account.findFirst({
      where: { user: { email: 'bob@example.com' } },
    });
    bobAccountId = bobAccount!.id;
  });

  afterAll(async () => {
    // Cleanup generated test user
    if (testUserId) {
      await prisma.onboarding.deleteMany({ where: { userId: testUserId } });
      await prisma.auditLog.deleteMany({ where: { actorId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    await prisma.$disconnect();
  });

  describe('User Registration', () => {
    it('successfully registers a new account holder with Argon2 hash and returns token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
      expect(res.body.data.user.role).toBe('ACCOUNT_HOLDER');
      expect(res.body.data.user.status).toBe('PENDING_ONBOARDING');
      expect(res.body.data.user.passwordHash).toBeUndefined(); // Sensitive field must never be exposed
      expect(res.body.data.accessToken).toBeDefined();

      // Check HttpOnly refresh cookie is set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('balancevault_refresh_token');
      expect(cookies[0]).toContain('HttpOnly');

      testUserId = res.body.data.user.id;
      testUserToken = res.body.data.accessToken;
    });

    it('rejects registration with duplicate email address (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects registration with weak password (422 Validation Error)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'weakpass@example.com',
          password: 'weak',
          fullName: 'Weak Password',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('prevents privilege escalation by rejecting self-registration as ADMIN', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'hacker_admin@example.com',
          password: 'SecurePassword123!',
          fullName: 'Fake Admin',
          role: 'ADMIN',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(res.body.error.details)).toContain('Privilege escalation rejected');
    });
  });

  describe('User Authentication & Login', () => {
    it('successfully authenticates with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('rejects authentication with incorrect password (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('Invalid email or password');
    });

    it('rejects authentication with non-existent user email (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nobody_exists@balancevault.local',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Protected Profile & Session Handling', () => {
    it('allows access to GET /api/v1/auth/me with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testUserId);
      expect(res.body.data.onboarding).toBeDefined();
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('rejects GET /api/v1/auth/me without token (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects GET /api/v1/auth/me with invalid or forged token (401 Unauthorized)', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer forged.invalid.token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('successfully logs out and clears refresh token cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.loggedOut).toBe(true);

      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toContain('balancevault_refresh_token=;');
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('allows ADMIN to access /api/v1/admin/overview', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.systemStatus).toBe('ALL_SYSTEMS_OPERATIONAL');
    });

    it('blocks ACCOUNT_HOLDER from accessing /api/v1/admin/overview (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Required role: ADMIN');
    });

    it('blocks AUDITOR from accessing /api/v1/admin/overview (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${auditorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows AUDITOR to access /api/v1/auditor/ledger-summary', async () => {
      const res = await request(app)
        .get('/api/v1/auditor/ledger-summary')
        .set('Authorization', `Bearer ${auditorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scope).toBe('READ_ONLY_AUDIT_TRAIL');
    });

    it('blocks ACCOUNT_HOLDER from accessing /api/v1/auditor/ledger-summary (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/auditor/ledger-summary')
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Account Ownership Authorization', () => {
    it('allows Alice (ACCOUNT_HOLDER) to access her own account details', async () => {
      const res = await request(app)
        .get(`/api/v1/accounts/${aliceAccountId}/details`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.account.id).toBe(aliceAccountId);
    });

    it("prevents Bob (ACCOUNT_HOLDER) from accessing Alice's account (403 Forbidden)", async () => {
      const res = await request(app)
        .get(`/api/v1/accounts/${aliceAccountId}/details`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Access denied');
    });

    it("allows ADMIN to access Alice's account for administrative review", async () => {
      const res = await request(app)
        .get(`/api/v1/accounts/${aliceAccountId}/details`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("allows AUDITOR to inspect Alice's account in read-only mode (GET)", async () => {
      const res = await request(app)
        .get(`/api/v1/accounts/${aliceAccountId}/details`)
        .set('Authorization', `Bearer ${auditorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("blocks AUDITOR from attempting to mutate an account via POST (403 Forbidden)", async () => {
      const res = await request(app)
        .post(`/api/v1/accounts/${aliceAccountId}/mutate`)
        .set('Authorization', `Bearer ${auditorToken}`)
        .send({ note: 'Unauthorized audit change' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Auditor role is strictly read-only and cannot perform mutations');
    });
  });

  describe('Rate Limiting on Authentication Endpoints', () => {
    it('enforces HTTP 429 Too Many Requests when rate limit threshold is exceeded', async () => {
      // Send 11 rapid requests with x-test-rate-limit header to trigger limiter
      let lastResponse;
      for (let i = 0; i < 11; i++) {
        lastResponse = await request(app)
          .post('/api/v1/auth/login')
          .set('x-test-rate-limit', 'true')
          .send({
            email: 'throttled@example.com',
            password: 'WrongPassword!',
          });
      }

      expect(lastResponse!.status).toBe(429);
      expect(lastResponse!.body.success).toBe(false);
      expect(lastResponse!.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(lastResponse!.headers['retry-after']).toBeDefined();
    });
  });

  describe('Audit Logging Verification', () => {
    it('verifies audit logs were written for registration, logins, and logouts', async () => {
      const logs = await prisma.auditLog.findMany({
        where: {
          action: { in: ['USER_REGISTERED', 'USER_LOGGED_IN', 'LOGIN_FAILED', 'USER_LOGGED_OUT'] },
        },
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain('USER_REGISTERED');
      expect(actions).toContain('USER_LOGGED_IN');
      expect(actions).toContain('LOGIN_FAILED');
      expect(actions).toContain('USER_LOGGED_OUT');
    });
  });
});
