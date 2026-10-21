import { AuditRepository } from './audit.repository';
import { AuditQueryParams } from './schemas/audit.schemas';

export class AuditService {
  constructor(private readonly repository: AuditRepository = new AuditRepository()) {}

  async getAuditLogs(params: AuditQueryParams) {
    const { items, total } = await this.repository.findWithFilters(params);
    const totalPages = Math.ceil(total / params.limit) || 1;

    return {
      items,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
      },
    };
  }
}
