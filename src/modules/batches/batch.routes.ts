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
  removeBatchMemberSchema,
  transferMenteeSchema,
  updateBatchSchema,
} from './schemas/batch.schemas';

export const batchRouter = Router();

// Super Admin batch operations
batchRouter.post(
  '/',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  validate(createBatchSchema),
  batchController.createBatch,
);

batchRouter.get('/', requireAuth, validate(batchQuerySchema), batchController.getBatches);

batchRouter.get('/:id', requireAuth, batchController.getBatchById);

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
