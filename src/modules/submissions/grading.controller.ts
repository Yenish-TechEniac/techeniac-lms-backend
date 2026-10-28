import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { gradingService } from './grading.service';
import type {
  GradeSubmissionInput,
  RequestResubmissionInput,
  SubmissionQueueQuery,
} from './schemas/grading.schemas';

export class GradingController {
  async getSubmissionQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.user!;
      const query = req.query as unknown as SubmissionQueueQuery;
      const result = await gradingService.getSubmissionQueue(query, actor);

      res.status(StatusCodes.OK).json({
        data: result.items,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getReviewDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.user!;
      const { submissionId } = req.params as { submissionId: string };
      const result = await gradingService.getReviewDetails(submissionId, actor);

      res.status(StatusCodes.OK).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async gradeSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.user!;
      const { submissionId } = req.params as { submissionId: string };
      const input = req.body as GradeSubmissionInput;
      const result = await gradingService.gradeSubmission(submissionId, input, actor);

      res.status(StatusCodes.OK).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async requestResubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.user!;
      const { submissionId } = req.params as { submissionId: string };
      const input = req.body as RequestResubmissionInput;
      const result = await gradingService.requestResubmission(submissionId, input, actor);

      res.status(StatusCodes.OK).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const gradingController = new GradingController();
