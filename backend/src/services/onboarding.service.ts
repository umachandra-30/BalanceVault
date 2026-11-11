import { AccountType, OnboardingStatus, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { ReviewOnboardingInput, SubmitOnboardingInput } from '../schemas/onboarding.schema.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/response.js';
import { recordAuditLog } from '../utils/audit.js';

export interface ServiceContext {
  ipAddress?: string;
  userAgent?: string;
}

export class OnboardingService {
  /**
   * Helper function to mask document numbers (e.g. "AB1234567" -> "******4567")
   */
  private maskDocumentNumber(docNum: string): string {
    const trimmed = docNum.trim();
    if (trimmed.length <= 4) return '******';
    const lastFour = trimmed.slice(-4);
    return `******${lastFour}`;
  }

  /**
   * Helper function to generate unique formatted account numbers (e.g. "BV-1004829104")
   */
  private async generateUniqueAccountNumber(): Promise<string> {
    for (let attempts = 0; attempts < 10; attempts++) {
      const randomSuffix = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      const candidate = `BV-${randomSuffix}`;
      const existing = await prisma.account.findUnique({ where: { accountNumber: candidate } });
      if (!existing) {
        return candidate;
      }
    }
    // Fallback using timestamp
    return `BV-${Date.now()}`;
  }

  /**
   * Submit KYC onboarding information for the current user
   */
  async submitOnboarding(userId: string, input: SubmitOnboardingInput, ctx: ServiceContext) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { onboarding: true },
    });

    if (!user) {
      throw new NotFoundError('User not found.');
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new ConflictError('Your account has already been approved and onboarding is complete.');
    }

    if (user.status === UserStatus.REJECTED) {
      throw new BadRequestError('Onboarding was previously rejected. Please contact an administrator.');
    }

    const documentNumberMasked = this.maskDocumentNumber(input.documentNumber);

    const updatedOnboarding = await prisma.onboarding.upsert({
      where: { userId },
      update: {
        status: OnboardingStatus.SUBMITTED,
        documentType: input.documentType,
        documentNumberMasked,
        notes: input.notes || null,
        submittedAt: new Date(),
      },
      create: {
        userId,
        status: OnboardingStatus.SUBMITTED,
        documentType: input.documentType,
        documentNumberMasked,
        notes: input.notes || null,
        submittedAt: new Date(),
      },
    });

    await recordAuditLog({
      action: 'ONBOARDING_SUBMITTED',
      actorId: user.id,
      actorRole: user.role,
      targetResource: 'ONBOARDING',
      targetId: updatedOnboarding.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { documentType: input.documentType },
    });

    return updatedOnboarding;
  }

  /**
   * Get onboarding status for current user
   */
  async getMyOnboarding(userId: string) {
    const onboarding = await prisma.onboarding.findUnique({
      where: { userId },
      include: {
        reviewedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!onboarding) {
      throw new NotFoundError('No onboarding record found for this user.');
    }

    return onboarding;
  }

  /**
   * List onboarding applications (for ADMIN and AUDITOR)
   */
  async listOnboardings(statusFilter?: OnboardingStatus) {
    return prisma.onboarding.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      include: {
        user: {
          select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
        },
        reviewedBy: {
          select: { id: true, email: true, fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Review onboarding application (ADMIN only)
   */
  async reviewOnboarding(
    adminId: string,
    onboardingId: string,
    input: ReviewOnboardingInput,
    ctx: ServiceContext
  ) {
    const onboarding = await prisma.onboarding.findUnique({
      where: { id: onboardingId },
      include: { user: true },
    });

    if (!onboarding) {
      throw new NotFoundError('Onboarding application not found.');
    }

    // Security Rule: Users (even admins) cannot approve or review their own onboarding
    if (onboarding.userId === adminId) {
      throw new ForbiddenError('Security violation: Administrators cannot review or approve their own onboarding application.');
    }

    const isApproval = input.decision === 'APPROVED';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update onboarding status
      const updatedOnboarding = await tx.onboarding.update({
        where: { id: onboardingId },
        data: {
          status: isApproval ? OnboardingStatus.APPROVED : OnboardingStatus.REJECTED,
          reviewedById: adminId,
          reviewedAt: new Date(),
          notes: input.notes || onboarding.notes,
        },
      });

      // 2. Update user status
      await tx.user.update({
        where: { id: onboarding.userId },
        data: {
          status: isApproval ? UserStatus.ACTIVE : UserStatus.REJECTED,
        },
      });

      // 3. If approved, ensure user has an initial Checking account provisioned
      let initialAccount = null;
      if (isApproval) {
        const existingAccount = await tx.account.findFirst({
          where: { userId: onboarding.userId },
        });

        if (!existingAccount) {
          const accountNumber = await this.generateUniqueAccountNumber();
          initialAccount = await tx.account.create({
            data: {
              accountNumber,
              userId: onboarding.userId,
              type: AccountType.CHECKING,
              currency: 'USD',
              balance: 0.0000,
            },
          });
        }
      }

      return { updatedOnboarding, initialAccount };
    });

    // 4. Record Audit Log
    await recordAuditLog({
      action: isApproval ? 'ONBOARDING_APPROVED' : 'ONBOARDING_REJECTED',
      actorId: adminId,
      actorRole: 'ADMIN',
      targetResource: 'ONBOARDING',
      targetId: onboarding.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        userId: onboarding.userId,
        decision: input.decision,
        notes: input.notes,
        provisionedAccount: result.initialAccount?.accountNumber,
      },
    });

    return result;
  }
}

export const onboardingService = new OnboardingService();

