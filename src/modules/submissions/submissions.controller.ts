import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import type { CreateSubmissionInput, ListMyAssignmentsQuery } from './schemas/submissions.schemas';
import { submissionsService } from './submissions.service';

export class SubmissionsController {
  async getMyAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const menteeId = req.user!.id;
      const query = req.query as unknown as ListMyAssignmentsQuery;

      const result = await submissionsService.getMyAssignments(menteeId, query);

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

  async getAssignmentSubmissionDetails(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const menteeId = req.user!.id;
      const { assignmentId } = req.params as { assignmentId: string };

      const result = await submissionsService.getAssignmentSubmissionDetails(
        menteeId,
        assignmentId,
      );

      res.status(StatusCodes.OK).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async submitAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const menteeId = req.user!.id;
      const input = req.body as CreateSubmissionInput;

      const result = await submissionsService.submitAssignment(menteeId, input);

      res.status(StatusCodes.CREATED).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const submissionsController = new SubmissionsController();
