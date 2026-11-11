import crypto from 'crypto';
import { AccountStatus, AccountType, OnboardingStatus, Role, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { BootstrapAdminInput } from '../schemas/bootstrap.schema.js';
import { hashPassword } from '../utils/password.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../utils/response.js';
import { recordAuditLog } from '../utils/audit.js';

export interface BootstrapContext {
  ipAddress?: string;
  userAgent?: string;
}

export class BootstrapService {
  /**
   * Timing-safe string comparison to protect against timing side-channel attacks.
   */
  private compareSecrets(providedSecret: string, expectedSecret: string): boolean {
    const providedBuffer = Buffer.from(providedSecret, 'utf-8');
    const expectedBuffer = Buffer.from(expectedSecret, 'utf-8');

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  }

  /**
   * Check if bootstrap is permitted (no existing ADMIN in system)
   */
  async canBootstrap(): Promise<{ canBootstrap: boolean; reason?: string }> {
    if (!env.ADMIN_BOOTSTRAP_SECRET) {
      return { canBootstrap: false, reason: 'ADMIN_BOOTSTRAP_SECRET is not configured on this server.' };
    }

    const adminCount = await prisma.user.count({
      where: { role: Role.ADMIN },
    });

    if (adminCount > 0) {
      return { canBootstrap: false, reason: 'An administrator account already exists. Bootstrap is disabled.' };
    }

    return { canBootstrap: true };
  }

  /**
   * Execute the controlled bootstrap procedure
   */
  async bootstrapAdmin(input: BootstrapAdminInput, ctx: BootstrapContext) {
    // 1. Verify bootstrap secret configuration
    const configuredSecret = env.ADMIN_BOOTSTRAP_SECRET;
    if (!configuredSecret) {
      throw new ForbiddenError('Administrator bootstrap is disabled on this server.');
    }

    // 2. Timing-safe verification of the supplied secret
    const isValidSecret = this.compareSecrets(input.bootstrapSecret, configuredSecret);
    if (!isValidSecret) {
      await recordAuditLog({
        action: 'ADMIN_BOOTSTRAP_FAILED',
        targetResource: 'SYSTEM',
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { attemptedEmail: input.email, reason: 'INVALID_BOOTSTRAP_SECRET' },
      });
      throw new UnauthorizedError('Invalid administrator bootstrap secret.');
    }

    // 3. Prevent repeated execution: Ensure no ADMIN already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: Role.ADMIN },
    });

    if (existingAdmin) {
      await recordAuditLog({
        action: 'ADMIN_BOOTSTRAP_BLOCKED',
        targetResource: 'SYSTEM',
        targetId: existingAdmin.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { attemptedEmail: input.email, reason: 'ADMIN_ALREADY_EXISTS' },
      });
      throw new ConflictError(
        'Administrator bootstrap rejected: An administrator account already exists. For security reasons, the bootstrap mechanism can only be executed once.'
      );
    }

    // 4. Ensure email is not already registered under another role
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictError('An account with this email address already exists.');
    }

    // 5. Hash password with Argon2id
    const passwordHash = await hashPassword(input.password);

    // 6. Execute atomic database initialization
    const adminUser = await prisma.$transaction(async (tx) => {
      // Create root administrator user
      const user = await tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          passwordHash,
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });

      // Automatically initialize approved onboarding profile for the admin
      await tx.onboarding.create({
        data: {
          userId: user.id,
          status: OnboardingStatus.APPROVED,
          documentType: 'SYSTEM_BOOTSTRAP',
          documentNumberMasked: 'ROOT-ADMIN',
          notes: 'Root system administrator provisioned via controlled bootstrap.',
          reviewedAt: new Date(),
        },
      });

      // Ensure system settlement account exists
      const existingSettlement = await tx.account.findUnique({
        where: { accountNumber: 'BV-SYSTEM-001' },
      });

      if (!existingSettlement) {
        await tx.account.create({
          data: {
            accountNumber: 'BV-SYSTEM-001',
            userId: user.id,
            type: AccountType.SYSTEM_SETTLEMENT,
            status: AccountStatus.ACTIVE,
            currency: 'USD',
            balance: 0.0000,
          },
        });
      }

      return user;
    });

    // 7. Record immutable audit log
    await recordAuditLog({
      action: 'ADMIN_BOOTSTRAP_EXECUTED',
      actorId: adminUser.id,
      actorRole: Role.ADMIN,
      targetResource: 'SYSTEM',
      targetId: adminUser.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        email: adminUser.email,
        fullName: adminUser.fullName,
        note: 'First root administrator initialized successfully.',
      },
    });

    return {
      id: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      role: adminUser.role,
      status: adminUser.status,
      createdAt: adminUser.createdAt,
    };
  }
}

export const bootstrapService = new BootstrapService();

