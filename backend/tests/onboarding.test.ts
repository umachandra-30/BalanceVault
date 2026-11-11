import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Phase 5 — Registration and Onboarding Workflow Tests', () => {
  const app = createApp();

  const applicant = {
    email: `applicant_${Date.now()}@example.com`,
    password: 'ApplicantPass2026!#',
    fullName: 'David Copperfield',
  };

  let applicantToken = '';
  let applicantId = '';
  let applicantOnboardingId = '';
  let adminToken = '';
  let adminId = '';

  beforeAll(async () => {
    // 1. Authenticate seeded Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@balancevault.local', password: 'DemoPass123!' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.accessToken;
    adminId = adminRes.body.data.user.id;

    // 2. Register applicant
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(applicant);
    expect(regRes.status).toBe(201);
    applicantToken = regRes.body.data.accessToken;
    applicantId = regRes.body.data.user.id;
  });

  afterAll(async () => {
    // Cleanup created applicant
    if (applicantId) {
      await prisma.account.deleteMany({ where: { userId: applicantId } });
      await prisma.onboarding.deleteMany({ where: { userId: applicantId } });
      await prisma.auditLog.deleteMany({ where: { actorId: applicantId } });
      await prisma.user.deleteMany({ where: { id: applicantId } });
    }
    await prisma.$disconnect();
  });

  describe('Step 1: Initial Registration & Onboarding State', () => {
    it('initializes applicant in PENDING_ONBOARDING status with NOT_STARTED onboarding', async () => {
      const statusRes = await request(app)
        .get('/api/v1/onboarding/status')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.success).toBe(true);
      expect(statusRes.body.data.status).toBe('NOT_STARTED');
      expect(statusRes.body.data.userId).toBe(applicantId);

      applicantOnboardingId = statusRes.body.data.id;
    });
  });

  describe('Step 2: Submitting Onboarding Information', () => {
    it('submits KYC documents with masked document number and updates status to SUBMITTED', async () => {
      const submitRes = await request(app)
        .post('/api/v1/onboarding/submit')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({
          documentType: 'PASSPORT',
          documentNumber: 'P987654321',
          notes: 'Standard applicant verification submission.',
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.data.status).toBe('SUBMITTED');
      expect(submitRes.body.data.documentType).toBe('PASSPORT');
      expect(submitRes.body.data.documentNumberMasked).toBe('******4321'); // Must be masked!
      expect(submitRes.body.data.submittedAt).toBeDefined();

      // Verify audit log was recorded
      const log = await prisma.auditLog.findFirst({
        where: { action: 'ONBOARDING_SUBMITTED', actorId: applicantId },
      });
      expect(log).toBeDefined();
    });

    it('rejects invalid document type (422 Validation Error)', async () => {
      const res = await request(app)
        .post('/api/v1/onboarding/submit')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({
          documentType: 'INVALID_DOC_TYPE',
          documentNumber: '123456789',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Step 3: Security & Authorization Checks on Review', () => {
    it('blocks regular user from listing admin onboarding applications (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/onboardings')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks regular user from approving their own onboarding (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/onboardings/${applicantOnboardingId}/review`)
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ decision: 'APPROVED' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Step 4: Administrator Review & Account Provisioning', () => {
    it('allows ADMIN to list pending onboarding requests', async () => {
      const res = await request(app)
        .get('/api/v1/admin/onboardings?status=SUBMITTED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const found = res.body.data.find((o: any) => o.id === applicantOnboardingId);
      expect(found).toBeDefined();
      expect(found.user.email).toBe(applicant.email.toLowerCase());
    });

    it('allows ADMIN to approve onboarding, activating the user and creating their initial CHECKING account', async () => {
      const reviewRes = await request(app)
        .patch(`/api/v1/admin/onboardings/${applicantOnboardingId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'APPROVED',
          notes: 'KYC verified successfully against synthetic sanction lists.',
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.success).toBe(true);
      expect(reviewRes.body.data.updatedOnboarding.status).toBe('APPROVED');
      expect(reviewRes.body.data.updatedOnboarding.reviewedById).toBe(adminId);
      expect(reviewRes.body.data.initialAccount).toBeDefined();
      expect(reviewRes.body.data.initialAccount.type).toBe('CHECKING');
      expect(reviewRes.body.data.initialAccount.accountNumber).toMatch(/^BV-\d+$/);

      // Verify user in DB is now ACTIVE
      const user = await prisma.user.findUnique({ where: { id: applicantId } });
      expect(user!.status).toBe('ACTIVE');

      // Verify audit log
      const log = await prisma.auditLog.findFirst({
        where: { action: 'ONBOARDING_APPROVED', actorId: adminId },
      });
      expect(log).toBeDefined();
    });

    it('reflects APPROVED status and reviewer notes on GET /api/v1/onboarding/status', async () => {
      const statusRes = await request(app)
        .get('/api/v1/onboarding/status')
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.status).toBe('APPROVED');
      expect(statusRes.body.data.reviewedBy.id).toBe(adminId);
      expect(statusRes.body.data.notes).toContain('KYC verified successfully');
    });

    it('prevents already-approved user from re-submitting onboarding (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/onboarding/submit')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({
          documentType: 'PASSPORT',
          documentNumber: 'P112233445',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already been approved');
    });
  });
});
