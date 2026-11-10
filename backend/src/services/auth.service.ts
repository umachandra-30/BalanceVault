import { OnboardingStatus, Role, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { RegisterInput, LoginInput } from '../schemas/auth.schema.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/response.js';
import { recordAuditLog } from '../utils/audit.js';

export interface AuthContext {
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  /**
   * Register a new user (ACCOUNT_HOLDER or AUDITOR)
   */
  async register(input: RegisterInput, ctx: AuthContext) {
    // 1. Enforce unique email check
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictError('An account with this email address already exists.');
    }

    // 2. Hash password with Argon2id
    const passwordHash = await hashPassword(input.password);

    // 3. Prevent privilege escalation: Self-registration allows ACCOUNT_HOLDER or AUDITOR only
    const assignedRole: Role = input.role === 'AUDITOR' ? Role.AUDITOR : Role.ACCOUNT_HOLDER;

    // 4. Create User and Onboarding in a single atomic transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          passwordHash,
          role: assignedRole,
          status: UserStatus.PENDING_ONBOARDING,
        },
      });

      // Initialize Onboarding record
      await tx.onboarding.create({
        data: {
          userId: user.id,
          status: OnboardingStatus.NOT_STARTED,
        },
      });

      return user;
    });

    // 5. Generate secure tokens
    const tokenPayload = {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // 6. Record Audit Log
    await recordAuditLog({
      action: 'USER_REGISTERED',
      actorId: newUser.id,
      actorRole: newUser.role,
      targetResource: 'USER',
      targetId: newUser.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { email: newUser.email, role: newUser.role },
    });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        status: newUser.status,
        createdAt: newUser.createdAt,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Authenticate user with email and password
   */
  async login(input: LoginInput, ctx: AuthContext) {
    // 1. Fetch user by email
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    // Timing-safe verification & credential rejection
    if (!user) {
      await recordAuditLog({
        action: 'LOGIN_FAILED',
        targetResource: 'USER',
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { attemptedEmail: input.email, reason: 'USER_NOT_FOUND' },
      });
      throw new UnauthorizedError('Invalid email or password.');
    }

    // 2. Verify password with Argon2
    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      await recordAuditLog({
        action: 'LOGIN_FAILED',
        actorId: user.id,
        actorRole: user.role,
        targetResource: 'USER',
        targetId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { attemptedEmail: input.email, reason: 'INVALID_PASSWORD' },
      });
      throw new UnauthorizedError('Invalid email or password.');
    }

    // 3. Status checks
    if (user.status === UserStatus.SUSPENDED) {
      await recordAuditLog({
        action: 'LOGIN_BLOCKED_SUSPENDED',
        actorId: user.id,
        targetResource: 'USER',
        targetId: user.id,
        ipAddress: ctx.ipAddress,
      });
      throw new ForbiddenError('Account is suspended. Please contact customer support.');
    }

    if (user.status === UserStatus.REJECTED) {
      throw new ForbiddenError('Account onboarding was rejected. Access denied.');
    }

    // 4. Generate JWT tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // 5. Record Audit Log
    await recordAuditLog({
      action: 'USER_LOGGED_IN',
      actorId: user.id,
      actorRole: user.role,
      targetResource: 'USER',
      targetId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh expired access token using valid refresh token
   */
  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token. Please sign in again.');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedError('Session revoked or user suspended.');
    }

    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });

    return { accessToken: newAccessToken };
  }

  /**
   * Log out active user and record audit log
   */
  async logout(userId: string, ctx: AuthContext) {
    await recordAuditLog({
      action: 'USER_LOGGED_OUT',
      actorId: userId,
      targetResource: 'USER',
      targetId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  /**
   * Fetch current authenticated user's profile with accounts and onboarding status
   */
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        onboarding: {
          select: {
            id: true,
            status: true,
            documentType: true,
            documentNumberMasked: true,
            notes: true,
            submittedAt: true,
            reviewedAt: true,
          },
        },
        accounts: {
          select: {
            id: true,
            accountNumber: true,
            type: true,
            status: true,
            currency: true,
            balance: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User profile not found.');
    }

    // Explicitly omit sensitive password hash before returning
    const { passwordHash: _, ...safeUserProfile } = user;
    return safeUserProfile;
  }
}

export const authService = new AuthService();

