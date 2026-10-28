import { Router } from 'express';

import { validate } from '../../core/http';
import { requireAuth, requireRole } from '../auth';
import { UserRole } from '../users';
import { progressController } from './progress.controller';
import {
  getProgressTrackerRouteSchema,
  getTopicProgressRouteSchema,
  updateTopicDeadlineRouteSchema,
  updateTopicStatusRouteSchema,
} from './schemas';

export const progressRouter = Router();

// Allocation-scoped topic progress routes
progressRouter.get(
  '/:id/topic-progress',
  requireAuth,
  validate(getTopicProgressRouteSchema),
  progressController.getTopicProgress,
);

progressRouter.patch(
  '/:id/topics/:topicId/status',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MENTEE),
  validate(updateTopicStatusRouteSchema),
  progressController.updateTopicStatus,
);

progressRouter.patch(
  '/:id/topics/:topicId/deadline',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MENTOR),
  validate(updateTopicDeadlineRouteSchema),
  progressController.updateTopicDeadline,
);

// Progress tracker routes (for Super Admin & Mentor within Mentor Scope)
export const progressTrackerRouter = Router();

progressTrackerRouter.get(
  '/trackers',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MENTOR),
  validate(getProgressTrackerRouteSchema),
  progressController.getProgressTracker,
);
