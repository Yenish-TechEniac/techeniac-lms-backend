import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { AuditService } from './audit.service';
import { AuditQueryParams } from './schemas/audit.schemas';

export class AuditController {
  constructor(private readonly service: AuditService = new AuditService()) {}

  getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as AuditQueryParams;
      const result = await this.service.getAuditLogs(query);

      res.status(StatusCodes.OK).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };
}
