import { DataSource, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';

import { AppDataSource } from '../../core/db';
import {
  Batch,
  BatchMember,
  BatchMemberRole,
  BatchReasonToLeave,
  BatchStatus,
  BatchStatusHistory,
} from './entities';
import { BatchQueryParams } from './schemas/batch.schemas';

export interface CreateBatchData {
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  description?: string | null;
  createdBy: string;
}

export interface UpdateBatchData {
  name?: string;
  startDate?: string;
  endDate?: string;
  description?: string | null;
}

export interface BatchWithCounts extends Batch {
  mentorsCount: number;
  menteesCount: number;
}

export class BatchRepository {
  private readonly batchRepo: Repository<Batch>;
  private readonly memberRepo: Repository<BatchMember>;
  private readonly historyRepo: Repository<BatchStatusHistory>;

  constructor(dataSource: DataSource = AppDataSource) {
    this.batchRepo = dataSource.getRepository(Batch);
    this.memberRepo = dataSource.getRepository(BatchMember);
    this.historyRepo = dataSource.getRepository(BatchStatusHistory);
  }

  public async findById(id: string): Promise<Batch | null> {
    return this.batchRepo.findOne({
      where: { id },
      relations: {
        creator: true,
      },
    });
  }

  public async findByCode(code: string): Promise<Batch | null> {
    return this.batchRepo.findOne({
      where: { code: code.trim().toUpperCase() },
    });
  }

  public async findActiveByName(name: string, excludeId?: string): Promise<Batch | null> {
    const qb = this.batchRepo
      .createQueryBuilder('batch')
      .where('LOWER(batch.name) = LOWER(:name)', { name: name.trim() })
      .andWhere('batch.status <> :archivedStatus', { archivedStatus: BatchStatus.ARCHIVED });

    if (excludeId) {
      qb.andWhere('batch.id <> :excludeId', { excludeId });
    }

    return qb.getOne();
  }

  public async create(data: CreateBatchData): Promise<Batch> {
    const batch = this.batchRepo.create({
      name: data.name.trim(),
      code: data.code.trim().toUpperCase(),
      startDate: data.startDate,
      endDate: data.endDate,
      description: data.description?.trim() ?? null,
      status: BatchStatus.DRAFT,
      createdBy: data.createdBy,
    });
    return this.batchRepo.save(batch);
  }

  public async update(id: string, data: UpdateBatchData): Promise<Batch> {
    const updatePayload: Partial<Batch> = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.startDate !== undefined) updatePayload.startDate = data.startDate;
    if (data.endDate !== undefined) updatePayload.endDate = data.endDate;
    if (data.description !== undefined) {
      updatePayload.description = data.description?.trim() ?? null;
    }

    await this.batchRepo.update(id, updatePayload);
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Batch not found after update');
    }
    return updated;
  }

  public async updateStatus(id: string, toStatus: BatchStatus): Promise<Batch> {
    await this.batchRepo.update(id, { status: toStatus });
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Batch not found after status update');
    }
    return updated;
  }

  public async findWithFilters(
    params: BatchQueryParams,
    mentorId?: string,
  ): Promise<{
    items: BatchWithCounts[];
    total: number;
  }> {
    const qb: SelectQueryBuilder<Batch> = this.batchRepo
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.creator', 'creator')
      .loadRelationCountAndMap('batch.mentorsCount', 'batch.members', 'mentor', (subQb) =>
        subQb.where('mentor.member_role = :mentorRole AND mentor.is_active = true', {
          mentorRole: BatchMemberRole.MENTOR,
        }),
      )
      .loadRelationCountAndMap('batch.menteesCount', 'batch.members', 'mentee', (subQb) =>
        subQb.where('mentee.member_role = :menteeRole AND mentee.is_active = true', {
          menteeRole: BatchMemberRole.MENTEE,
        }),
      );

    if (mentorId) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM batch_members bm
          WHERE bm.batch_id = batch.id
            AND bm.user_id = :mentorId
            AND bm.member_role = :mentorRole
            AND bm.is_active = true
            AND bm.deleted_at IS NULL
        )`,
        { mentorId, mentorRole: BatchMemberRole.MENTOR },
      );
    }

    if (params.status) {
      qb.andWhere('batch.status = :status', { status: params.status });
    }

    if (params.search) {
      const search = `%${params.search.trim()}%`;
      qb.andWhere('(batch.name ILIKE :search OR batch.code ILIKE :search)', { search });
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    qb.orderBy('batch.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    const itemsWithCounts: BatchWithCounts[] = items.map((b) => ({
      ...b,
      mentorsCount: (b as unknown as { mentorsCount?: number }).mentorsCount ?? 0,
      menteesCount: (b as unknown as { menteesCount?: number }).menteesCount ?? 0,
    }));

    return { items: itemsWithCounts, total };
  }

  // --- Status History ---
  public async recordStatusHistory(
    batchId: string,
    fromStatus: BatchStatus | null,
    toStatus: BatchStatus,
    changedBy: string,
    reason?: string | null,
  ): Promise<BatchStatusHistory> {
    const history = this.historyRepo.create({
      batchId,
      fromStatus,
      toStatus,
      changedBy,
      reason: reason?.trim() ?? null,
    });
    return this.historyRepo.save(history);
  }

  public async getStatusHistory(batchId: string): Promise<BatchStatusHistory[]> {
    return this.historyRepo.find({
      where: { batchId },
      relations: { changer: true },
      order: { changedAt: 'ASC' },
    });
  }

  // --- Batch Members ---
  public async findActiveMenteeMembership(userId: string): Promise<BatchMember | null> {
    return this.memberRepo.findOne({
      where: {
        userId,
        memberRole: BatchMemberRole.MENTEE,
        isActive: true,
      },
      relations: {
        batch: true,
      },
    });
  }

  public async findActiveMemberInBatch(
    batchId: string,
    userId: string,
  ): Promise<BatchMember | null> {
    return this.memberRepo.findOne({
      where: {
        batchId,
        userId,
        isActive: true,
      },
      relations: {
        user: true,
      },
    });
  }

  public async findMembersByBatchId(batchId: string): Promise<BatchMember[]> {
    return this.memberRepo.find({
      where: {
        batchId,
        isActive: true,
      },
      relations: {
        user: true,
      },
      order: {
        joinedAt: 'ASC',
      },
    });
  }

  public async addMember(
    batchId: string,
    userId: string,
    memberRole: BatchMemberRole,
  ): Promise<BatchMember> {
    const member = this.memberRepo.create({
      batchId,
      userId,
      memberRole,
      isActive: true,
      joinedAt: new Date(),
    });
    return this.memberRepo.save(member);
  }

  public async removeMember(
    membershipId: string,
    reason: BatchReasonToLeave = BatchReasonToLeave.REMOVED,
  ): Promise<void> {
    await this.memberRepo.update(membershipId, {
      isActive: false,
      leftAt: new Date(),
      reasonToLeave: reason,
    });
  }

  public async countActiveMentors(batchId: string): Promise<number> {
    return this.memberRepo.count({
      where: {
        batchId,
        memberRole: BatchMemberRole.MENTOR,
        isActive: true,
      },
    });
  }

  public async closeoutActiveMentees(batchId: string): Promise<void> {
    const activeMentees = await this.memberRepo.find({
      where: {
        batchId,
        memberRole: BatchMemberRole.MENTEE,
        isActive: true,
      },
    });

    if (activeMentees.length > 0) {
      const now = new Date();
      await this.memberRepo.update(
        { id: In(activeMentees.map((m) => m.id)) },
        {
          isActive: false,
          leftAt: now,
          reasonToLeave: BatchReasonToLeave.BATCH_COMPLETED,
        },
      );
    }
  }

  public async closeActiveMembershipsForUser(
    userId: string,
    reason: BatchReasonToLeave = BatchReasonToLeave.ROLE_CHANGE,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(BatchMember) : this.memberRepo;
    await repo.update(
      { userId, isActive: true },
      {
        isActive: false,
        leftAt: new Date(),
        reasonToLeave: reason,
      },
    );
  }
}

export const batchRepository = new BatchRepository();
