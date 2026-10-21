import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { AppDataSource } from '../../core/db';
import { AuditLog, AuditType } from './entities/audit-log.entity';
import { AuditQueryParams } from './schemas/audit.schemas';

export interface CreateAuditLogData {
  actorId?: string | null;
  type: AuditType;
  entity: string;
  entityId?: string | null;
  action: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

export class AuditRepository {
  private readonly repo: Repository<AuditLog>;

  constructor(dataSource: DataSource = AppDataSource) {
    this.repo = dataSource.getRepository(AuditLog);
  }

  public async create(data: CreateAuditLogData): Promise<AuditLog> {
    const log = this.repo.create({
      actorId: data.actorId ?? null,
      type: data.type,
      entity: data.entity,
      entityId: data.entityId ?? null,
      action: data.action,
      oldValue: data.oldValue ?? null,
      newValue: data.newValue ?? null,
    });
    return this.repo.save(log);
  }

  public async findWithFilters(
    params: AuditQueryParams,
  ): Promise<{ items: AuditLog[]; total: number }> {
    const qb: SelectQueryBuilder<AuditLog> = this.repo
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.actor', 'actor');

    if (params.type) {
      qb.andWhere('audit.type = :type', { type: params.type });
    }

    if (params.actorId) {
      qb.andWhere('audit.actor_id = :actorId', { actorId: params.actorId });
    }

    if (params.entity) {
      qb.andWhere('audit.entity ILIKE :entity', { entity: `%${params.entity}%` });
    }

    if (params.action) {
      qb.andWhere('audit.action ILIKE :action', { action: `%${params.action}%` });
    }

    if (params.startDate) {
      qb.andWhere('audit.created_at >= :startDate', { startDate: new Date(params.startDate) });
    }

    if (params.endDate) {
      qb.andWhere('audit.created_at <= :endDate', { endDate: new Date(params.endDate) });
    }

    qb.orderBy('audit.created_at', 'DESC')
      .skip((params.page - 1) * params.limit)
      .take(params.limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }
}

export const auditRepository = new AuditRepository();
