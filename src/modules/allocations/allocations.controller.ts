import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../core/auth';
import { UnauthorizedError } from '../../core/errors';
import { BaseController } from '../../core/http';
import { AllocationsService, allocationsService } from './allocations.service';
import type {
  AddMenteesToAllocationInput,
  AssignmentDueOverrideInput,
  BulkAssignmentDueOverrideInput,
  BulkUpdateAllocationDatesInput,
  CreateAllocationsInput,
  ListAllocationsQuery,
  UpdateAllocationDatesInput,
} from './schemas/allocation.schemas';

export class AllocationsController extends BaseController {
  constructor(private readonly service: AllocationsService = allocationsService) {
    super();
  }

  private getAuthUser(req: Request): AuthenticatedUser {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    return req.user;
  }

  public createAllocations = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const result = await this.service.createAllocations(req.body as CreateAllocationsInput, actor);
    this.sendCreated(res, { allocations: result.created, skipped: result.skipped });
  };

  public listAllocations = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const query = req.query as unknown as ListAllocationsQuery;
    const result = await this.service.listAllocations(query, actor);
    this.sendPaginated(res, result.allocations, result.page, result.limit, result.total);
  };

  public getAllocationById = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const allocation = await this.service.getAllocationById(String(req.params.id), actor);
    this.sendSuccess(res, { allocation });
  };

  public updateAllocationDates = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const updated = await this.service.updateAllocationDates(
      String(req.params.id),
      req.body as UpdateAllocationDatesInput,
      actor,
    );
    this.sendSuccess(res, { allocation: updated });
  };

  public bulkUpdateAllocationDates = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const result = await this.service.bulkUpdateAllocationDates(
      req.body as BulkUpdateAllocationDatesInput,
      actor,
    );
    this.sendSuccess(res, { allocations: result.allocations, skipped: result.skipped });
  };

  public revokeAllocation = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const revoked = await this.service.revokeAllocation(String(req.params.id), actor);
    this.sendSuccess(res, { allocation: revoked });
  };

  public addMenteesToAllocation = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const result = await this.service.addMenteesToBatchAllocation(
      String(req.params.id),
      req.body as AddMenteesToAllocationInput,
      actor,
    );
    this.sendCreated(res, { allocations: result.created, skipped: result.skipped });
  };

  public setAssignmentDueOverride = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const override = await this.service.setAssignmentDueOverride(
      String(req.params.id),
      req.body as AssignmentDueOverrideInput,
      actor,
    );
    this.sendSuccess(res, { override });
  };

  public bulkSetAssignmentDueOverrides = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const result = await this.service.bulkSetAssignmentDueOverrides(
      req.body as BulkAssignmentDueOverrideInput,
      actor,
    );
    this.sendSuccess(res, { overrides: result.overrides, skipped: result.skipped });
  };

  public getAssignmentOverrides = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getAuthUser(req);
    const overrides = await this.service.getAssignmentOverrides(String(req.params.id), actor);
    this.sendSuccess(res, { overrides });
  };
}

export const allocationsController = new AllocationsController();
