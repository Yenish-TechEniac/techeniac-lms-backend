import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { BaseController } from '../../core/http/base.controller';
import { AuditService, auditService } from './audit.service';
import { AuditQueryParams } from './schemas/audit.schemas';

export class AuditController extends BaseController {
  constructor(private readonly service: AuditService = auditService) {
    super();
  }

  getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as AuditQueryParams;
      const result = await this.service.getAuditLogs(query);

      res.status(StatusCodes.OK).json({
        success: true,
        data: result.items,
        meta: result.pagination,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const auditController = new AuditController();
