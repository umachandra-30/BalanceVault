import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';

export interface CreateAuditLogParams {
  action: string;
  actorId?: string | null;
  actorRole?: string | null;
  targetResource: string;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Asynchronously record an audit event.
 * Designed to not interrupt the primary user transaction if logging fails,
 * while ensuring errors are logged immediately.
 */
export async function recordAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        actorId: params.actorId || null,
        actorRole: params.actorRole || null,
        targetResource: params.targetResource,
        targetId: params.targetId || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        metadata: params.metadata || {},
      },
    });
  } catch (err) {
    logger.error(`Failed to write audit log for action: ${params.action}`, err);
  }
}
