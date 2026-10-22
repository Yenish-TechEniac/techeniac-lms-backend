import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors';
import { UserRepository, userRepository, UserRole } from '../users';
import { BatchRepository, batchRepository } from './batch.repository';
import { BatchMemberRole, BatchReasonToLeave, BatchStatus } from './entities';
import {
  AddBatchMembersInput,
  BatchQueryParams,
  ChangeBatchStatusInput,
  CreateBatchInput,
  TransferMenteeInput,
  UpdateBatchInput,
} from './schemas/batch.schemas';

const ALLOWED_STATUS_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  [BatchStatus.DRAFT]: [BatchStatus.LIVE, BatchStatus.ARCHIVED],
  [BatchStatus.LIVE]: [BatchStatus.ON_HOLD, BatchStatus.COMPLETED],
  [BatchStatus.ON_HOLD]: [BatchStatus.LIVE, BatchStatus.COMPLETED],
  [BatchStatus.COMPLETED]: [BatchStatus.ARCHIVED],
  [BatchStatus.ARCHIVED]: [],
};

export class BatchService {
  constructor(
    private readonly batchRepo: BatchRepository = batchRepository,
    private readonly userRepo: UserRepository = userRepository,
  ) {}

  public async createBatch(input: CreateBatchInput, actorId: string) {
    const existingCode = await this.batchRepo.findByCode(input.code);
    if (existingCode) {
      throw new ConflictError(`Batch with code "${input.code}" already exists`);
    }

    const existingName = await this.batchRepo.findActiveByName(input.name);
    if (existingName) {
      throw new ConflictError(`A non-archived batch with name "${input.name}" already exists`);
    }

    const batch = await this.batchRepo.create({
      ...input,
      createdBy: actorId,
    });

    await this.batchRepo.recordStatusHistory(
      batch.id,
      null,
      BatchStatus.DRAFT,
      actorId,
      'Initial batch creation in DRAFT status',
    );

    return batch;
  }

  public async getBatches(params: BatchQueryParams) {
    const { items, total } = await this.batchRepo.findWithFilters(params);
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
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

  public async getBatchById(id: string) {
    const batch = await this.batchRepo.findById(id);
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    const members = await this.batchRepo.findMembersByBatchId(id);
    const statusHistory = await this.batchRepo.getStatusHistory(id);

    const mentors = members.filter((m) => m.memberRole === BatchMemberRole.MENTOR);
    const mentees = members.filter((m) => m.memberRole === BatchMemberRole.MENTEE);

    return {
      batch,
      mentors,
      mentees,
      statusHistory,
    };
  }

  public async updateBatch(id: string, input: UpdateBatchInput) {
    const batch = await this.batchRepo.findById(id);
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    if (batch.status === BatchStatus.ARCHIVED) {
      throw new BadRequestError('Archived batches cannot be edited');
    }

    if (input.name && input.name.toLowerCase() !== batch.name.toLowerCase()) {
      const existingName = await this.batchRepo.findActiveByName(input.name, id);
      if (existingName) {
        throw new ConflictError(`A non-archived batch with name "${input.name}" already exists`);
      }
    }

    const newStartDate = input.startDate ?? batch.startDate;
    const newEndDate = input.endDate ?? batch.endDate;
    if (new Date(newStartDate) > new Date(newEndDate)) {
      throw new BadRequestError('Start date must be before or equal to end date');
    }

    const updated = await this.batchRepo.update(id, input);

    return updated;
  }

  public async changeBatchStatus(id: string, input: ChangeBatchStatusInput, actorId: string) {
    const batch = await this.batchRepo.findById(id);
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    const currentStatus = batch.status;
    const targetStatus = input.toStatus;

    if (currentStatus === targetStatus) {
      return batch;
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BadRequestError(`Cannot transition batch from ${currentStatus} to ${targetStatus}`);
    }

    if (targetStatus === BatchStatus.LIVE) {
      const mentorCount = await this.batchRepo.countActiveMentors(id);
      if (mentorCount < 1) {
        throw new BadRequestError(
          'A batch must have at least one active mentor before transitioning to LIVE',
        );
      }
    }

    // FR-5.3 rule: Completed ends mentee memberships with BATCH_COMPLETED
    if (targetStatus === BatchStatus.COMPLETED) {
      await this.batchRepo.closeoutActiveMentees(id);
    }

    const updated = await this.batchRepo.updateStatus(id, targetStatus);

    await this.batchRepo.recordStatusHistory(
      id,
      currentStatus,
      targetStatus,
      actorId,
      input.reason,
    );

    return updated;
  }

  public async addMembers(id: string, input: AddBatchMembersInput) {
    const batch = await this.batchRepo.findById(id);
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    if (batch.status === BatchStatus.ARCHIVED || batch.status === BatchStatus.COMPLETED) {
      throw new BadRequestError(`Cannot add members to a batch in ${batch.status} status`);
    }

    const addedMembers = [];

    for (const userId of input.userIds) {
      const user = await this.userRepo.findById(userId);
      if (!user || !user.isActive) {
        throw new BadRequestError(`User ${userId} not found or is deactivated`);
      }

      // Check role compatibility
      if (input.memberRole === BatchMemberRole.MENTEE && user.role !== UserRole.MENTEE) {
        throw new BadRequestError(
          `User "${user.name}" has role ${user.role} and cannot be added as a MENTEE`,
        );
      }
      if (input.memberRole === BatchMemberRole.MENTOR && user.role !== UserRole.MENTOR) {
        throw new BadRequestError(
          `User "${user.name}" has role ${user.role} and cannot be added as a MENTOR`,
        );
      }

      // Check if already active in this batch
      const alreadyInThisBatch = await this.batchRepo.findActiveMemberInBatch(id, userId);
      if (alreadyInThisBatch) {
        continue; // Already a member
      }

      // FR-5.2 & Rule 209: A mentee can be an active member of only one batch at a time
      if (input.memberRole === BatchMemberRole.MENTEE) {
        const activeMembership = await this.batchRepo.findActiveMenteeMembership(userId);
        if (activeMembership) {
          throw new ConflictError(
            `Mentee "${user.name}" is already an active member of batch "${activeMembership.batch.name}". Use batch transfer to move them.`,
          );
        }
      }

      const member = await this.batchRepo.addMember(id, userId, input.memberRole);
      addedMembers.push(member);
    }

    return addedMembers;
  }

  public async removeMember(batchId: string, userId: string) {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    const membership = await this.batchRepo.findActiveMemberInBatch(batchId, userId);
    if (!membership) {
      throw new NotFoundError('Active member not found in this batch');
    }

    // Rule: At least one mentor per batch
    if (membership.memberRole === BatchMemberRole.MENTOR) {
      const activeMentors = await this.batchRepo.countActiveMentors(batchId);
      if (
        activeMentors <= 1 &&
        (batch.status === BatchStatus.LIVE || batch.status === BatchStatus.DRAFT)
      ) {
        throw new BadRequestError('A batch must have at least one active mentor');
      }
    }

    await this.batchRepo.removeMember(membership.id, BatchReasonToLeave.REMOVED);
  }

  public async transferMentee(sourceBatchId: string, input: TransferMenteeInput) {
    if (sourceBatchId === input.targetBatchId) {
      throw new BadRequestError('Source and target batches must be different');
    }

    const [sourceBatch, targetBatch] = await Promise.all([
      this.batchRepo.findById(sourceBatchId),
      this.batchRepo.findById(input.targetBatchId),
    ]);

    if (!sourceBatch) {
      throw new NotFoundError('Source batch not found');
    }
    if (!targetBatch) {
      throw new NotFoundError('Target batch not found');
    }

    if (
      targetBatch.status === BatchStatus.ARCHIVED ||
      targetBatch.status === BatchStatus.COMPLETED
    ) {
      throw new BadRequestError(
        `Cannot transfer mentee into a batch with status ${targetBatch.status}`,
      );
    }

    const currentMembership = await this.batchRepo.findActiveMemberInBatch(
      sourceBatchId,
      input.menteeId,
    );
    if (!currentMembership || currentMembership.memberRole !== BatchMemberRole.MENTEE) {
      throw new NotFoundError('Mentee is not an active member of the source batch');
    }

    // 1. End old membership with BATCH_TRANSFER
    await this.batchRepo.removeMember(currentMembership.id, BatchReasonToLeave.BATCH_TRANSFER);

    // 2. Add to target batch
    const newMembership = await this.batchRepo.addMember(
      input.targetBatchId,
      input.menteeId,
      BatchMemberRole.MENTEE,
    );

    return newMembership;
  }
}

export const batchService = new BatchService();
