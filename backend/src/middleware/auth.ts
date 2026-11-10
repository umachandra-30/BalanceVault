import { NextFunction, Request, Response } from 'express';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/response.js';

// Extend Express Request interface to include authenticated user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        fullName: string;
        role: Role;
        status: UserStatus;
      };
      targetAccount?: {
        id: string;
        userId: string;
        status: string;
        accountNumber?: string;
      };
    }
  }
}

/**
 * Authentication Middleware:
 * Extracts JWT token from Authorization header or HttpOnly cookie,
 * verifies signature and freshness, and attaches the active user to `req.user`.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
    // 2. Fallback to HttpOnly cookie
    else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new UnauthorizedError('Authentication required. No valid access token provided.');
    }

    // 3. Verify JWT
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired authentication token. Please log in again.');
    }

    // 4. Verify user exists in database and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User account associated with this token no longer exists.');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Account is suspended. Please contact customer support.');
    }

    if (user.status === UserStatus.REJECTED) {
      throw new ForbiddenError('Account onboarding was rejected. Access denied.');
    }

    // Attach validated user to request object
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware:
 * Guards endpoints to ensure only users with specified roles can proceed.
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Forbidden: Role '${req.user.role}' is not authorized to access this resource. Required role: ${allowedRoles.join(' or ')}.`
        )
      );
    }

    next();
  };
}

/**
 * Account Ownership Authorization Middleware:
 * Ensures users can never access or modify another customer's financial account.
 * - ADMIN: Granted full access.
 * - AUDITOR: Granted read-only access (GET/HEAD only).
 * - ACCOUNT_HOLDER: Permitted only if the account belongs directly to them.
 */
export function requireAccountOwnership(paramName = 'accountId') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const accountId =
        req.params[paramName] ||
        req.body[paramName] ||
        (req.query[paramName] as string);

      if (!accountId) {
        throw new ForbiddenError(`Account identifier ('${paramName}') must be provided.`);
      }

      // Query database for account ownership
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          userId: true,
          status: true,
          accountNumber: true,
        },
      });

      if (!account) {
        throw new NotFoundError(`Account not found`);
      }

      // Check role permissions:
      // 1. ADMIN: Authorized for operational administration
      if (req.user.role === Role.ADMIN) {
        req.targetAccount = account;
        return next();
      }

      // 2. AUDITOR: Strictly read-only access
      if (req.user.role === Role.AUDITOR) {
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
          throw new ForbiddenError('Auditor role is strictly read-only and cannot perform mutations.');
        }
        req.targetAccount = account;
        return next();
      }

      // 3. ACCOUNT_HOLDER: Must be verified owner
      if (account.userId !== req.user.id) {
        // Prevent account enumeration & unauthorized access
        throw new ForbiddenError('Access denied: You do not have permission to access this account.');
      }

      req.targetAccount = account;
      next();
    } catch (error) {
      next(error);
    }
  };
}

