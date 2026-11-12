import { NextFunction, Request, Response } from 'express';
import { auditLogQuerySchema } from '../schemas/audit.schema.js';
import { auditService } from '../services/audit.service.js';
import { sendSuccess } from '../utils/response.js';

export class AuditController {
  /**
   * GET /api/v1/audit-logs
   */
  listAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = auditLogQuerySchema.parse(req.query);
      const result = await auditService.listAuditLogs(query);

      sendSuccess(res, result.logs, 'Audit logs retrieved successfully', 200, result.meta);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/audit-logs/stats
   */
  getAuditStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await auditService.getAuditStats();
      sendSuccess(res, stats, 'Audit statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/audit-logs/:id
   */
  getAuditLogById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const log = await auditService.getAuditLogById(req.params.id);
      sendSuccess(res, log, 'Audit log details retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}

export const auditController = new AuditController();

