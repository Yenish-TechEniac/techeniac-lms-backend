import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../core/auth';
import { UnauthorizedError } from '../../core/errors';
import { BaseController } from '../../core/http';
import { GradingService, gradingService } from './grading.service';
import type {
  GradeSubmissionInput,
  RequestResubmissionInput,
  SubmissionQueueQuery,
} from './schemas/grading.schemas';

export class GradingController extends BaseController {
  constructor(private readonly service: GradingService = gradingService) {
    super();
  }

  private getAuthUser(req: Request): AuthenticatedUser {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    return req.user;
  }

  public getSubmissionQueue = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const query = req.query as unknown as SubmissionQueueQuery;
    const result = await this.service.getSubmissionQueue(query, actor);

    this.sendPaginated(res, result.items, result.page, result.limit, result.total);
  };

  public getReviewDetails = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const { submissionId } = req.params as { submissionId: string };
    const result = await this.service.getReviewDetails(submissionId, actor);

    this.sendSuccess(res, result);
  };

  public gradeSubmission = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const { submissionId } = req.params as { submissionId: string };
    const input = req.body as GradeSubmissionInput;
    const result = await this.service.gradeSubmission(submissionId, input, actor);

    this.sendSuccess(res, result);
  };

  public requestResubmission = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const { submissionId } = req.params as { submissionId: string };
    const input = req.body as RequestResubmissionInput;
    const result = await this.service.requestResubmission(submissionId, input, actor);

    this.sendSuccess(res, result);
  };
}

export const gradingController = new GradingController();
