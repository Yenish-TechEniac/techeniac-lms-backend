import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../core/auth';
import { UnauthorizedError } from '../../core/errors';
import { BaseController } from '../../core/http';
import { ProgressService, progressService } from './progress.service';
import type {
  TrackerQueryInput,
  UpdateTopicDeadlineInput,
  UpdateTopicStatusInput,
} from './schemas';

export class ProgressController extends BaseController {
  constructor(private readonly service: ProgressService = progressService) {
    super();
  }

  private getAuthUser(req: Request): AuthenticatedUser {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    return req.user;
  }

  public getTopicProgress = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const result = await this.service.getTopicProgressForAllocation(String(req.params.id), actor);
    this.sendSuccess(res, result);
  };

  public updateTopicStatus = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const result = await this.service.updateTopicStatus(
      String(req.params.id),
      String(req.params.topicId),
      req.body as UpdateTopicStatusInput,
      actor,
    );
    this.sendSuccess(res, result);
  };

  public updateTopicDeadline = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const result = await this.service.updateTopicDeadline(
      String(req.params.id),
      String(req.params.topicId),
      req.body as UpdateTopicDeadlineInput,
      actor,
    );
    this.sendSuccess(res, result);
  };

  public getProgressTracker = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const query = req.query as unknown as TrackerQueryInput;
    const result = await this.service.getMenteeProgressTracker(query, actor);
    this.sendSuccess(res, { trackers: result.trackers, pagination: result.pagination });
  };
}

export const progressController = new ProgressController();
