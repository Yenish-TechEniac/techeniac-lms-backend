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
  (req, res, next) => {
    void submissionsController.getMyAssignments(req, res, next);
  },
);

submissionsRouter.get(
  '/assignments/:assignmentId',
  validate(assignmentIdParamSchema),
  (req, res, next) => {
    void submissionsController.getAssignmentSubmissionDetails(req, res, next);
  },
);

submissionsRouter.post('/', validate(createSubmissionSchema), (req, res, next) => {
  void submissionsController.submitAssignment(req, res, next);
});
