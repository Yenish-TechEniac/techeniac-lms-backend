import { Router } from 'express';

import { validate } from '../../core/http';
import { requireAuth, requireRole } from '../auth';
import { gradingController } from './grading.controller';
import {
  gradeSubmissionSchema,
  requestResubmissionSchema,
  submissionIdParamSchema,
  submissionQueueQuerySchema,
} from './schemas/grading.schemas';
import {
  assignmentIdParamSchema,
  createSubmissionSchema,
  listMyAssignmentsQuerySchema,
} from './schemas/submissions.schemas';
import { submissionsController } from './submissions.controller';

export const submissionsRouter = Router();

// Authentication required for all submission routes
submissionsRouter.use(requireAuth);

/* -------------------------------------------------------------------------- */
/* Mentor / Super Admin Grading Endpoints (PRD M10: FR-10.1 - FR-10.7)        */
/* -------------------------------------------------------------------------- */
const gradingAuth = requireRole('SUPER_ADMIN', 'MENTOR');

submissionsRouter.get(
  '/queue',
  gradingAuth,
  validate(submissionQueueQuerySchema),
  (req, res, next) => {
    void gradingController.getSubmissionQueue(req, res, next);
  },
);

submissionsRouter.get(
  '/:submissionId/review',
  gradingAuth,
  validate(submissionIdParamSchema),
  (req, res, next) => {
    void gradingController.getReviewDetails(req, res, next);
  },
);

submissionsRouter.post(
  '/:submissionId/grade',
  gradingAuth,
  validate(gradeSubmissionSchema),
  (req, res, next) => {
    void gradingController.gradeSubmission(req, res, next);
  },
);

submissionsRouter.post(
  '/:submissionId/resubmit-request',
  gradingAuth,
  validate(requestResubmissionSchema),
  (req, res, next) => {
    void gradingController.requestResubmission(req, res, next);
  },
);

/* -------------------------------------------------------------------------- */
/* Mentee Submissions Endpoints (PRD M9: FR-9.1 - FR-9.7)                     */
/* -------------------------------------------------------------------------- */
const menteeAuth = requireRole('MENTEE');

submissionsRouter.get(
  '/my-assignments',
  menteeAuth,
  validate(listMyAssignmentsQuerySchema),
  (req, res, next) => {
    void submissionsController.getMyAssignments(req, res, next);
  },
);

submissionsRouter.get(
  '/assignments/:assignmentId',
  menteeAuth,
  validate(assignmentIdParamSchema),
  (req, res, next) => {
    void submissionsController.getAssignmentSubmissionDetails(req, res, next);
  },
);

submissionsRouter.post('/', menteeAuth, validate(createSubmissionSchema), (req, res, next) => {
  void submissionsController.submitAssignment(req, res, next);
});
