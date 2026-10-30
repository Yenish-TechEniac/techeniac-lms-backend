import type { NextFunction, Request, Response } from 'express';

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

      this.sendPaginated(
        res,
        result.items,
        result.pagination.page,
        result.pagination.limit,
        result.pagination.total,
      );
    } catch (error) {
      next(error);
    }
  };
}

export const auditController = new AuditController();
