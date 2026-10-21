import { AuditRepository } from './audit.repository';
import { AuditQueryParams } from './schemas/audit.schemas';

export class AuditService {
  constructor(private readonly repository: AuditRepository = new AuditRepository()) {}

  async getAuditLogs(params: AuditQueryParams) {
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params?.limit) || 20));

    const { items, total } = await this.repository.findWithFilters({
      ...params,
      page,
      limit,
    });
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}
