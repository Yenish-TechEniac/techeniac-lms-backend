import type { NextFunction, Request, Response } from 'express';

import { BaseController } from '../../core/http';
import type { User360ExportParams, User360QueryParams } from './user-360.schemas';
import { User360Service, user360Service } from './user-360.service';

export class User360Controller extends BaseController {
  constructor(private readonly service: User360Service = user360Service) {
    super();
  }

  public getUser360 = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const query = (req.query || {}) as unknown as User360QueryParams;
      const profile = await this.service.getUser360(String(id), query);
      this.sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  };

  public exportUser360 = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const query = (req.query || {}) as unknown as User360ExportParams;
      const csv = await this.service.exportUser360Csv(String(id), query);
      const filename = `user-360-${String(id)}-${Date.now()}.csv`;
      this.sendFile(res, Buffer.from(csv, 'utf-8'), filename, 'text/csv');
    } catch (error) {
      next(error);
    }
  };
}

export const user360Controller = new User360Controller();
