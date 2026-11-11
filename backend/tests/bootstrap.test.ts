import request from 'supertest';
import { describe, expect, it, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { env } from '../src/config/env.js';

describe('Phase 4 — First Administrator Bootstrap Tests', () => {
  const app = createApp();

  const validBootstrapPayload = {
    bootstrapSecret: env.ADMIN_BOOTSTRAP_SECRET,
    email: 'new_root_admin@balancevault.local',
    fullName: 'Bootstrapped Root Admin',
    password: 'SuperAdminPass2026!#',
  };

  afterAll(async () => {
    // Clean up created bootstrap admin if test created one
    const user = await prisma.user.findUnique({
      where: { email: 'new_root_admin@balancevault.local' },
    });
    if (user) {
      await prisma.onboarding.deleteMany({ where: { userId: user.id } });
      await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
      await prisma.account.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
  });

  describe('Bootstrap Preconditions & Rejection Checks', () => {
    it('rejects bootstrap attempt when bootstrap secret is incorrect (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/bootstrap-admin')
        .send({
          ...validBootstrapPayload,
          bootstrapSecret: 'wrong_secret_12345678',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('Invalid administrator bootstrap secret');

      // Verify audit log recorded the failure
      const log = await prisma.auditLog.findFirst({
        where: { action: 'ADMIN_BOOTSTRAP_FAILED' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toBeDefined();
    });

    it('rejects bootstrap attempt with weak password (422 Validation Error)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/bootstrap-admin')
        .send({
          ...validBootstrapPayload,
          password: 'weak',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects bootstrap if an ADMIN already exists in the database (409 Conflict)', async () => {
      // Ensure at least one admin exists (seeded admin)
      const existingAdmin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });
      expect(existingAdmin).toBeDefined();

      const res = await request(app)
        .post('/api/v1/auth/bootstrap-admin')
        .send(validBootstrapPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('An administrator account already exists');

      // Verify audit log recorded the blocked attempt
      const log = await prisma.auditLog.findFirst({
        where: { action: 'ADMIN_BOOTSTRAP_BLOCKED' },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toBeDefined();
    });

    it('reports bootstrap status as disabled when an ADMIN exists', async () => {
      const res = await request(app).get('/api/v1/auth/bootstrap-status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.canBootstrap).toBe(false);
      expect(res.body.data.reason).toContain('administrator account already exists');
    });
  });

  describe('Full Bootstrap Lifecycle (Simulated Greenfield Test)', () => {
    it('executes successful bootstrap when no admin exists, then locks, and admin logs in', async () => {
      // 1. Temporarily backup existing admin role
      const existingAdmins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
      });

      // Temporarily set role of existing admins to AUDITOR to simulate greenfield state
      await prisma.user.updateMany({
        where: { role: 'ADMIN' },
        data: { role: 'AUDITOR' },
      });

      try {
        // 2. Check status: should now report canBootstrap = true
        const statusRes = await request(app).get('/api/v1/auth/bootstrap-status');
        expect(statusRes.status).toBe(200);
        expect(statusRes.body.data.canBootstrap).toBe(true);

        // 3. Execute bootstrap
        const bootstrapRes = await request(app)
          .post('/api/v1/auth/bootstrap-admin')
          .send(validBootstrapPayload);

        expect(bootstrapRes.status).toBe(201);
        expect(bootstrapRes.body.success).toBe(true);
        expect(bootstrapRes.body.data.admin.email).toBe(validBootstrapPayload.email);
        expect(bootstrapRes.body.data.admin.role).toBe('ADMIN');
        expect(bootstrapRes.body.data.admin.status).toBe('ACTIVE');

        // 4. Verify audit log was recorded
        const auditRecord = await prisma.auditLog.findFirst({
          where: { action: 'ADMIN_BOOTSTRAP_EXECUTED', targetId: bootstrapRes.body.data.admin.id },
        });
        expect(auditRecord).toBeDefined();

        // 5. Verify immediate locking: second attempt must return 409 Conflict
        const secondAttemptRes = await request(app)
          .post('/api/v1/auth/bootstrap-admin')
          .send({
            ...validBootstrapPayload,
            email: 'another_admin@example.com',
          });

        expect(secondAttemptRes.status).toBe(409);
        expect(secondAttemptRes.body.error.code).toBe('CONFLICT');

        // 6. Verify newly bootstrapped administrator can successfully log in
        const loginRes = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: validBootstrapPayload.email,
            password: validBootstrapPayload.password,
          });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.success).toBe(true);
        expect(loginRes.body.data.accessToken).toBeDefined();
        expect(loginRes.body.data.user.role).toBe('ADMIN');

        // 7. Verify the admin can access protected admin routes
        const adminOverviewRes = await request(app)
          .get('/api/v1/admin/overview')
          .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

        expect(adminOverviewRes.status).toBe(200);
        expect(adminOverviewRes.body.data.systemStatus).toBe('ALL_SYSTEMS_OPERATIONAL');
      } finally {
        // Restore previous admin roles
        for (const admin of existingAdmins) {
          await prisma.user.update({
            where: { id: admin.id },
            data: { role: 'ADMIN' },
          });
        }
      }
    });
  });
});
