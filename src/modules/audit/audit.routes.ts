import { Router } from 'express';

import { requireAuth, requireRole } from '../../core/auth';
import { validate } from '../../core/http';
import { UserRole } from '../users';
import { AuditController } from './audit.controller';
import { getAuditLogsSchema } from './schemas/audit.schemas';

export const auditRouter = Router();
const controller = new AuditController();

auditRouter.get(
  '/',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(getAuditLogsSchema),
  controller.getAuditLogs,
);
