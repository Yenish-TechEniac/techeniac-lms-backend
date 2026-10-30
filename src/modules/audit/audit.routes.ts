import { Router } from 'express';

import { validate } from '../../core/http';
import { requireAuth, requireRole } from '../auth';
import { UserRole } from '../users';
import { auditController } from './audit.controller';
import { getAuditLogsSchema } from './schemas/audit.schemas';

export const auditRouter = Router();

auditRouter.get(
  '/',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(getAuditLogsSchema),
  auditController.getAuditLogs,
);
