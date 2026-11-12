import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AuditLogQueryInput } from '../schemas/audit.schema.js';
import { NotFoundError } from '../utils/response.js';

export class AuditService {
  /**
   * List paginated audit logs with multi-attribute filtering & search
   */
  async listAuditLogs(query: AuditLogQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (query.action) {
      where.action = { equals: query.action };
    }

    if (query.targetResource) {
      where.targetResource = { equals: query.targetResource };
    }

    if (query.outcome) {
      where.outcome = { equals: query.outcome };
    }

    if (query.actorRole) {
      where.actorRole = { equals: query.actorRole };
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (query.endDate.length === 10) {
          end.setHours(23, 59, 59, 999);
        }
        where.createdAt.lte = end;
      }
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { action: { contains: term, mode: 'insensitive' } },
        { targetResource: { contains: term, mode: 'insensitive' } },
        { targetId: { contains: term, mode: 'insensitive' } },
        { correlationId: { contains: term, mode: 'insensitive' } },
        { actor: { email: { contains: term, mode: 'insensitive' } } },
        { actor: { fullName: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [totalCount, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        actorId: log.actorId,
        actorRole: log.actorRole,
        actor: log.actor,
        targetResource: log.targetResource,
        targetId: log.targetId,
        outcome: log.outcome,
        correlationId: log.correlationId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Get audit log event detail by ID
   */
  async getAuditLogById(id: string) {
    const log = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        actor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!log) {
      throw new NotFoundError('Audit log record not found.');
    }

    return log;
  }

  /**
   * Aggregate statistics for the Audit Console
   */
  async getAuditStats() {
    const [totalCount, failureCount, financialCount, adminCount] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({
        where: {
          OR: [
            { outcome: { in: ['FAILURE', 'DENIED'] } },
            { action: { contains: 'FAILURE' } },
            { action: { contains: 'FAILED' } },
          ],
        },
      }),
      prisma.auditLog.count({
        where: {
          action: {
            in: ['DEPOSIT_EXECUTED', 'WITHDRAWAL_EXECUTED', 'TRANSFER_EXECUTED'],
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          action: {
            in: [
              'ADMIN_BOOTSTRAP',
              'ACCOUNT_STATUS_UPDATED',
              'ONBOARDING_APPROVED',
              'ONBOARDING_REJECTED',
            ],
          },
        },
      }),
    ]);

    return {
      totalCount,
      failureCount,
      financialCount,
      adminCount,
    };
  }
}

export const auditService = new AuditService();

