import { Router } from 'express';

import { validate } from '../../core/http';
import { requireAuth, requireRole } from '../auth';
import { UserRole } from '../users';
import { batchController } from './batch.controller';
import { getBatchByIdSchema, mentorQuerySchema } from './schemas';

export const mentorRouter = Router();

// Restricted to Mentors only (Section 2.1 Mentor Scope)
mentorRouter.use(requireAuth, requireRole(UserRole.MENTOR));

mentorRouter.get('/batches', batchController.getBatches);
mentorRouter.get('/batches/:id', validate(getBatchByIdSchema), batchController.getBatchById);
mentorRouter.get('/mentees', validate(mentorQuerySchema), batchController.getMentorMentees);
