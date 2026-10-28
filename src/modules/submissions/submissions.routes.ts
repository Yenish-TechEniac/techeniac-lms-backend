import { Router } from 'express';

import { validate } from '../../core/http';
import { requireAuth, requireRole } from '../auth';
import {
  assignmentIdParamSchema,
  createSubmissionSchema,
  listMyAssignmentsQuerySchema,
} from './schemas/submissions.schemas';
import { submissionsController } from './submissions.controller';

export const submissionsRouter = Router();

// Submissions endpoints require authenticated MENTEE role
submissionsRouter.use(requireAuth, requireRole('MENTEE'));

submissionsRouter.get(
  '/my-assignments',
  validate(listMyAssignmentsQuerySchema),
  submissionsController.getMyAssignments,
);

submissionsRouter.get(
  '/assignments/:assignmentId',
  validate(assignmentIdParamSchema),
  submissionsController.getAssignmentSubmissionDetails,
);

submissionsRouter.post(
  '/',
  validate(createSubmissionSchema),
  submissionsController.submitAssignment,
);
