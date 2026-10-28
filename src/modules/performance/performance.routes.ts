import { Router } from 'express';

import { validate } from '../../core/http';
import { requireAuth, requireRole } from '../auth';
import { UserRole } from '../users';
import { performanceController } from './performance.controller';
import { exportPerformanceSchema, performanceFilterSchema } from './schemas';

export const performanceRouter = Router();

performanceRouter.use(requireAuth);

performanceRouter.get(
  '/',
  requireRole(UserRole.SUPER_ADMIN, UserRole.MENTOR),
  validate(performanceFilterSchema),
  performanceController.getPerformance,
);

performanceRouter.get(
  '/export',
  requireRole(UserRole.SUPER_ADMIN, UserRole.MENTOR),
  validate(exportPerformanceSchema),
  performanceController.exportPerformance,
);
