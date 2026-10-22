import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { BatchService, batchService } from './batch.service';
import {
  AddBatchMembersInput,
  BatchQueryParams,
  ChangeBatchStatusInput,
  CreateBatchInput,
  TransferMenteeInput,
  UpdateBatchInput,
} from './schemas/batch.schemas';

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
    const result = await this.service.getBatches(req.query as unknown as BatchQueryParams);
    res.status(StatusCodes.OK).json({
      success: true,
      data: result,
    });
  };

  public getBatchById = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
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
}

export const batchController = new BatchController();
