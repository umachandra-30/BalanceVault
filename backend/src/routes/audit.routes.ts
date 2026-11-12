import { Router } from 'express';
import { Role } from '@prisma/client';
import { auditController } from '../controllers/audit.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Only ADMIN and AUDITOR roles can access the audit trail
router.use(authenticate, requireRole(Role.ADMIN, Role.AUDITOR));

router.get('/stats', auditController.getAuditStats);
router.get('/', auditController.listAuditLogs);
router.get('/:id', auditController.getAuditLogById);

export default router;

