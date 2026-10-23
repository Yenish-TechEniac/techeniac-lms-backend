import { Router } from 'express';

import { requireAuth, requireRole } from '../auth';
import { UserRole } from '../users';
import { batchController } from './batch.controller';

export const menteeRouter = Router();

// Restricted to Mentees only
menteeRouter.use(requireAuth, requireRole(UserRole.MENTEE));

menteeRouter.get('/batch', batchController.getMyBatch);
