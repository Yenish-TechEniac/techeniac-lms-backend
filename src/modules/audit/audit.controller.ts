import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { AuditService, auditService } from './audit.service';
import { getAuditLogsSchema } from './schemas/audit.schemas';

export class AuditController {
  constructor(private readonly service: AuditService = auditService) {}

  getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = getAuditLogsSchema.shape.query.parse(req.query);
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

export const auditController = new AuditController();
