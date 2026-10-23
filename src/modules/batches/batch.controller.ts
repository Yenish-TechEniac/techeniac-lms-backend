import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { UserRole } from '../users';
import { BatchService, batchService } from './batch.service';
import {
  AddBatchMembersInput,
  BatchQueryParams,
  ChangeBatchStatusInput,
  CreateBatchInput,
  MapMenteesInput,
  ReassignMenteeInput,
  TransferMenteeInput,
  UpdateBatchInput,
} from './schemas';

export class BatchController {
  constructor(private readonly service: BatchService = batchService) {}

  public createBatch = async (req: Request, res: Response): Promise<void> => {
    const actorId = req.user!.id;
    const batch = await this.service.createBatch(req.body as CreateBatchInput, actorId);
    res.status(StatusCodes.CREATED).json({
      success: true,
      data: { batch },
    });
  };

  public getBatches = async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const mentorId = (user.role as UserRole) === UserRole.MENTOR ? user.id : undefined;
    const result = await this.service.getBatches(req.query as unknown as BatchQueryParams);
    // If user is mentor, filter items
    if (mentorId) {
      const mentorResult = await this.service.getBatchesForMentor(
        mentorId,
        req.query as unknown as BatchQueryParams,
      );
      res.status(StatusCodes.OK).json({
        success: true,
        data: mentorResult,
      });
      return;
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: result,
    });
  };

  public getBatchById = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const user = req.user!;

    if ((user.role as UserRole) === UserRole.MENTOR) {
      const result = await this.service.getBatchByIdForMentor(id, user.id);
      res.status(StatusCodes.OK).json({
        success: true,
        data: result,
      });
      return;
    }

    const result = await this.service.getBatchById(id);
    res.status(StatusCodes.OK).json({
      success: true,
      data: result,
    });
  };

  public updateBatch = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const batch = await this.service.updateBatch(id, req.body as UpdateBatchInput);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { batch },
    });
  };

  public changeBatchStatus = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const actorId = req.user!.id;
    const batch = await this.service.changeBatchStatus(
      id,
      req.body as ChangeBatchStatusInput,
      actorId,
    );
    res.status(StatusCodes.OK).json({
      success: true,
      data: { batch },
    });
  };

  public addMembers = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const members = await this.service.addMembers(id, req.body as AddBatchMembersInput);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { members },
    });
  };

  public removeMember = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const userId = String(req.params.userId);
    await this.service.removeMember(id, userId);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { message: 'Member removed successfully' },
    });
  };

  public transferMentee = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const membership = await this.service.transferMentee(id, req.body as TransferMenteeInput);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { membership },
    });
  };

  // --- Mentor-Mentee Mappings ---

  public mapMentees = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const mappings = await this.service.mapMentees(id, req.body as MapMenteesInput);
    res.status(StatusCodes.CREATED).json({
      success: true,
      data: { mappings },
    });
  };

  public reassignMentee = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const mapping = await this.service.reassignMentee(id, req.body as ReassignMenteeInput);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { mapping },
    });
  };

  public getBatchMappings = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const mappings = await this.service.getBatchMappings(id);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { mappings },
    });
  };

  // --- Mentor and Mentee Specific Views ---

  public getMentorMentees = async (req: Request, res: Response): Promise<void> => {
    const mentorId = req.user!.id;
    const batchId = typeof req.query.batchId === 'string' ? req.query.batchId : undefined;
    const mentees = await this.service.getMenteesForMentor(mentorId, batchId);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { mentees },
    });
  };

  public getMyBatch = async (req: Request, res: Response): Promise<void> => {
    const menteeId = req.user!.id;
    const result = await this.service.getBatchForMentee(menteeId);
    res.status(StatusCodes.OK).json({
      success: true,
      data: result,
    });
  };
}

export const batchController = new BatchController();
