import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../core/auth';
import { UnauthorizedError } from '../../core/errors';
import { BaseController } from '../../core/http';
import type { CreateSubmissionInput, ListMyAssignmentsQuery } from './schemas/submissions.schemas';
import { SubmissionsService, submissionsService } from './submissions.service';

export class SubmissionsController extends BaseController {
  constructor(private readonly service: SubmissionsService = submissionsService) {
    super();
  }

  private getAuthUser(req: Request): AuthenticatedUser {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    return req.user;
  }

  public getMyAssignments = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const query = req.query as unknown as ListMyAssignmentsQuery;

    const result = await this.service.getMyAssignments(actor.id, query);
    this.sendPaginated(res, result.items, result.page, result.limit, result.total);
  };

  public getAssignmentSubmissionDetails = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const { assignmentId } = req.params as { assignmentId: string };

    const result = await this.service.getAssignmentSubmissionDetails(actor.id, assignmentId);
    this.sendSuccess(res, result);
  };

  public submitAssignment = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const input = req.body as CreateSubmissionInput;

    const result = await this.service.submitAssignment(actor.id, input);
    this.sendCreated(res, result);
  };
}

export const submissionsController = new SubmissionsController();
