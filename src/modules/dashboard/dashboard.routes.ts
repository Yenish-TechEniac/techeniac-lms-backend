import { Router } from 'express';

import { requireAuth, requireRole } from '../auth';
import { UserRole } from '../users';
import { dashboardController } from './dashboard.controller';

export const dashboardRouter = Router();

// Authentication required for all dashboard routes
dashboardRouter.use(requireAuth);

/* -------------------------------------------------------------------------- */
/* Role-Based Dashboard Endpoints (PRD M12: FR-12.1 - FR-12.5)                */
/* -------------------------------------------------------------------------- */

dashboardRouter.get(
  '/admin',
  requireRole(UserRole.SUPER_ADMIN),
  dashboardController.getAdminDashboard,
);

dashboardRouter.get(
  '/mentor',
  requireRole(UserRole.MENTOR),
  dashboardController.getMentorDashboard,
);

dashboardRouter.get(
  '/mentee',
  requireRole(UserRole.MENTEE),
  dashboardController.getMenteeDashboard,
);
