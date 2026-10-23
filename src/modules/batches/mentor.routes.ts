import { Router } from 'express';

import { requireAuth, requireRole } from '../auth';
import { UserRole } from '../users';
import { batchController } from './batch.controller';

export const mentorRouter = Router();

// Restricted to Mentors only (Section 2.1 Mentor Scope)
mentorRouter.use(requireAuth, requireRole(UserRole.MENTOR));

mentorRouter.get('/batches', batchController.getBatches);
mentorRouter.get('/batches/:id', batchController.getBatchById);
mentorRouter.get('/mentees', batchController.getMentorMentees);
