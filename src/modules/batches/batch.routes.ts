import { Router } from 'express';

import { validate } from '../../core/http';
import { requireAuth, requireRole } from '../auth';
import { UserRole } from '../users';
import { batchController } from './batch.controller';
import {
  addBatchMembersSchema,
  batchQuerySchema,
  changeBatchStatusSchema,
  createBatchSchema,
  getBatchByIdSchema,
  mapMenteesSchema,
  reassignMenteeSchema,
  removeBatchMemberSchema,
  transferMenteeSchema,
  updateBatchSchema,
} from './schemas';

export const batchRouter = Router();

// Super Admin batch operations
batchRouter.post(
  '/',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(createBatchSchema),
  batchController.createBatch,
);

batchRouter.get(
  '/',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MENTOR),
  validate(batchQuerySchema),
  batchController.getBatches,
);

batchRouter.get(
  '/:id',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MENTOR),
  validate(getBatchByIdSchema),
  batchController.getBatchById,
);

batchRouter.patch(
  '/:id',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(updateBatchSchema),
  batchController.updateBatch,
);

batchRouter.post(
  '/:id/status',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(changeBatchStatusSchema),
  batchController.changeBatchStatus,
);

batchRouter.post(
  '/:id/members',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(addBatchMembersSchema),
  batchController.addMembers,
);

batchRouter.delete(
  '/:id/members/:userId',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(removeBatchMemberSchema),
  batchController.removeMember,
);

batchRouter.post(
  '/:id/transfer-mentee',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(transferMenteeSchema),
  batchController.transferMentee,
);

// Mentor-Mentee Mappings inside Batch (FR-4.1 - 4.3)
batchRouter.post(
  '/:id/mappings',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(mapMenteesSchema),
  batchController.mapMentees,
);

batchRouter.post(
  '/:id/mappings/reassign',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(reassignMenteeSchema),
  batchController.reassignMentee,
);

batchRouter.get(
  '/:id/mappings',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(getBatchByIdSchema),
  batchController.getBatchMappings,
);
