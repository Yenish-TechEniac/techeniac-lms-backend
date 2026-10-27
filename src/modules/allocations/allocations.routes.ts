import { Router } from 'express';

import { validate } from '../../core/http';
import { requireAuth, requireRole } from '../auth';
import { allocationsController } from './allocations.controller';
import {
  addMenteesToAllocationSchema,
  allocationIdParamSchema,
  assignmentDueOverrideSchema,
  bulkAssignmentDueOverrideSchema,
  bulkUpdateAllocationDatesSchema,
  createAllocationsSchema,
  listAllocationsQuerySchema,
  revokeAllocationSchema,
  updateAllocationDatesSchema,
} from './schemas/allocation.schemas';

export const allocationsRouter = Router();

// Bulk operations (must come before parameterized /:id routes)
allocationsRouter.patch(
  '/bulk',
  requireAuth,
  requireRole('SUPER_ADMIN', 'MENTOR'),
  validate(bulkUpdateAllocationDatesSchema),
  allocationsController.bulkUpdateAllocationDates,
);

allocationsRouter.post(
  '/bulk-assignment-overrides',
  requireAuth,
  requireRole('SUPER_ADMIN', 'MENTOR'),
  validate(bulkAssignmentDueOverrideSchema),
  allocationsController.bulkSetAssignmentDueOverrides,
);

// List & Create
allocationsRouter.get(
  '/',
  requireAuth,
  validate(listAllocationsQuerySchema),
  allocationsController.listAllocations,
);

allocationsRouter.post(
  '/',
  requireAuth,
  requireRole('SUPER_ADMIN', 'MENTOR'),
  validate(createAllocationsSchema),
  allocationsController.createAllocations,
);

// Individual allocation routes
allocationsRouter.get(
  '/:id',
  requireAuth,
  validate(allocationIdParamSchema),
  allocationsController.getAllocationById,
);

allocationsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('SUPER_ADMIN', 'MENTOR'),
  validate(updateAllocationDatesSchema),
  allocationsController.updateAllocationDates,
);

allocationsRouter.post(
  '/:id/revoke',
  requireAuth,
  requireRole('SUPER_ADMIN', 'MENTOR'),
  validate(revokeAllocationSchema),
  allocationsController.revokeAllocation,
);

allocationsRouter.post(
  '/:id/add-mentees',
  requireAuth,
  requireRole('SUPER_ADMIN', 'MENTOR'),
  validate(addMenteesToAllocationSchema),
  allocationsController.addMenteesToAllocation,
);

allocationsRouter.post(
  '/:id/assignment-overrides',
  requireAuth,
  requireRole('SUPER_ADMIN', 'MENTOR'),
  validate(assignmentDueOverrideSchema),
  allocationsController.setAssignmentDueOverride,
);

allocationsRouter.get(
  '/:id/assignment-overrides',
  requireAuth,
  validate(allocationIdParamSchema),
  allocationsController.getAssignmentOverrides,
);
