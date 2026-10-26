import { AppDataSource } from '../../core/db';
import { EmailService, emailService } from '../../core/email';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors';
import { User, UserRepository, userRepository, UserRole } from '../users';
import { BatchRepository, batchRepository } from './batch.repository';
import { BatchMemberRole, BatchReasonToLeave, BatchStatus } from './entities';
import { MentorMenteeRepository, mentorMenteeRepository } from './mentor-mentee.repository';
import {
  AddBatchMembersInput,
  BatchQueryParams,
  ChangeBatchStatusInput,
  CreateBatchInput,
  MapMenteesInput,
  ReassignMenteeInput,
  TransferMenteeInput,
  UpdateBatchInput,
} from './schemas';

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
    private readonly mentorMenteeRepo: MentorMenteeRepository = mentorMenteeRepository,
    private readonly emailSvc: EmailService = emailService,
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
    const activeMappings = await this.mentorMenteeRepo.findActiveMappingsByBatch(id);
    const mappingByMenteeId = new Map(activeMappings.map((m) => [m.menteeId, m.mentor]));

    const mentors = members.filter((m) => m.memberRole === BatchMemberRole.MENTOR);
    const mentees = members
      .filter((m) => m.memberRole === BatchMemberRole.MENTEE)
      .map((m) => {
        const mappedMentor = mappingByMenteeId.get(m.userId);
        return {
          ...m,
          mappedToUser: mappedMentor ? { id: mappedMentor.id, name: mappedMentor.name } : null,
        };
      });

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

    // Archived: batch mappings end
    if (targetStatus === BatchStatus.ARCHIVED) {
      await this.mentorMenteeRepo.closeAllMappingsForBatch(id, 'BATCH_ARCHIVED');
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
        continue;
      }

      // FR-5.2: A mentee can be an active member of only one batch at a time
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
    await this.mentorMenteeRepo.closeAllMappingsForMember(batchId, userId, 'MEMBER_REMOVED');
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

    // 2. End old mapping in source batch
    await this.mentorMenteeRepo.closeAllMappingsForMember(
      sourceBatchId,
      input.menteeId,
      'BATCH_TRANSFER',
    );

    // 3. Add to target batch
    const newMembership = await this.batchRepo.addMember(
      input.targetBatchId,
      input.menteeId,
      BatchMemberRole.MENTEE,
    );

    return newMembership;
  }

  // --- Mentor-Mentee Mapping Methods (FR-4.1 - 4.3) ---

  public async mapMentees(batchId: string, input: MapMenteesInput) {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    if (batch.status === BatchStatus.ARCHIVED || batch.status === BatchStatus.COMPLETED) {
      throw new BadRequestError(`Cannot map mentees in a batch with status ${batch.status}`);
    }

    const mentorUser = await this.userRepo.findById(input.mentorId);
    if (!mentorUser || mentorUser.role !== UserRole.MENTOR) {
      throw new BadRequestError('User does not have the MENTOR role');
    }

    const mentorMembership = await this.batchRepo.findActiveMemberInBatch(batchId, input.mentorId);
    if (!mentorMembership || mentorMembership.memberRole !== BatchMemberRole.MENTOR) {
      throw new BadRequestError('Specified mentor is not an active mentor member in this batch');
    }

    const menteeUsers: User[] = [];
    for (const menteeId of input.menteeIds) {
      if (menteeId === input.mentorId) {
        throw new BadRequestError('A mentor cannot be mapped to themselves as a mentee');
      }

      const menteeUser = await this.userRepo.findById(menteeId);
      if (!menteeUser || menteeUser.role !== UserRole.MENTEE) {
        throw new BadRequestError(`User ${menteeId} does not have the MENTEE role`);
      }

      const menteeMembership = await this.batchRepo.findActiveMemberInBatch(batchId, menteeId);
      if (!menteeMembership || menteeMembership.memberRole !== BatchMemberRole.MENTEE) {
        throw new BadRequestError(`User ${menteeId} is not an active mentee member in this batch`);
      }

      const existingMapping = await this.mentorMenteeRepo.findActiveByMenteeAndBatch(
        batchId,
        menteeId,
      );
      if (existingMapping) {
        if (existingMapping.mentorId === input.mentorId) {
          continue;
        }
        throw new ConflictError(
          `Mentee is already actively mapped in this batch. Use reassign to change their mentor.`,
        );
      }
      menteeUsers.push(menteeUser);
    }

    const created = await AppDataSource.transaction(async (manager) => {
      const records = [];
      for (const menteeUser of menteeUsers) {
        const mapping = await this.mentorMenteeRepo.createMapping(
          {
            batchId,
            mentorId: input.mentorId,
            menteeId: menteeUser.id,
          },
          manager,
        );
        records.push(mapping);
      }
      return records;
    });

    // Post-commit notifications (PRD Section 7.2)
    for (const menteeUser of menteeUsers) {
      void this.emailSvc.sendMentorMappedEmail({
        to: mentorUser.email,
        recipientName: mentorUser.name,
        isMentor: true,
        otherPartyName: menteeUser.name,
        batchName: batch.name,
      });

      void this.emailSvc.sendMentorMappedEmail({
        to: menteeUser.email,
        recipientName: menteeUser.name,
        isMentor: false,
        otherPartyName: mentorUser.name,
        batchName: batch.name,
      });
    }

    return created;
  }

  public async reassignMentee(batchId: string, input: ReassignMenteeInput) {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    if (batch.status === BatchStatus.ARCHIVED || batch.status === BatchStatus.COMPLETED) {
      throw new BadRequestError(`Cannot reassign mentees in a batch with status ${batch.status}`);
    }

    if (input.menteeId === input.newMentorId) {
      throw new BadRequestError('A mentor cannot be mapped to themselves as a mentee');
    }

    const newMentorUser = await this.userRepo.findById(input.newMentorId);
    if (!newMentorUser || newMentorUser.role !== UserRole.MENTOR) {
      throw new BadRequestError('Target mentor does not have the MENTOR role');
    }

    const menteeUser = await this.userRepo.findById(input.menteeId);
    if (!menteeUser || menteeUser.role !== UserRole.MENTEE) {
      throw new BadRequestError('Target user does not have the MENTEE role');
    }

    const newMentorMembership = await this.batchRepo.findActiveMemberInBatch(
      batchId,
      input.newMentorId,
    );
    if (!newMentorMembership || newMentorMembership.memberRole !== BatchMemberRole.MENTOR) {
      throw new BadRequestError('Target mentor is not an active mentor member in this batch');
    }

    const menteeMembership = await this.batchRepo.findActiveMemberInBatch(batchId, input.menteeId);
    if (!menteeMembership || menteeMembership.memberRole !== BatchMemberRole.MENTEE) {
      throw new BadRequestError('Mentee is not an active member in this batch');
    }

    const existingMapping = await this.mentorMenteeRepo.findActiveByMenteeAndBatch(
      batchId,
      input.menteeId,
    );
    if (existingMapping && existingMapping.mentorId === input.newMentorId) {
      return existingMapping;
    }

    const oldMentorUser = existingMapping?.mentorId
      ? await this.userRepo.findById(existingMapping.mentorId)
      : null;

    const result = await AppDataSource.transaction(async (manager) => {
      if (existingMapping) {
        await this.mentorMenteeRepo.closeMapping(
          existingMapping.id,
          input.reason || 'REASSIGNED',
          manager,
        );
      }

      return await this.mentorMenteeRepo.createMapping(
        {
          batchId,
          mentorId: input.newMentorId,
          menteeId: input.menteeId,
        },
        manager,
      );
    });

    // Post-commit reassignment notifications (PRD Section 7.2)
    void this.emailSvc.sendMenteeReassignedEmail({
      to: menteeUser.email,
      recipientName: menteeUser.name,
      recipientRole: 'MENTEE',
      menteeName: menteeUser.name,
      mentorName: newMentorUser.name,
      batchName: batch.name,
      reason: input.reason ?? undefined,
    });

    void this.emailSvc.sendMenteeReassignedEmail({
      to: newMentorUser.email,
      recipientName: newMentorUser.name,
      recipientRole: 'NEW_MENTOR',
      menteeName: menteeUser.name,
      mentorName: newMentorUser.name,
      batchName: batch.name,
      reason: input.reason ?? undefined,
    });

    if (oldMentorUser) {
      void this.emailSvc.sendMenteeReassignedEmail({
        to: oldMentorUser.email,
        recipientName: oldMentorUser.name,
        recipientRole: 'PREVIOUS_MENTOR',
        menteeName: menteeUser.name,
        mentorName: newMentorUser.name,
        batchName: batch.name,
        reason: input.reason ?? undefined,
      });
    }

    return result;
  }

  public async getBatchMappings(batchId: string) {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }
    return await this.mentorMenteeRepo.findActiveMappingsByBatch(batchId);
  }

  // --- Mentor Scoped Endpoints (Section 2.1) ---

  public async getBatchesForMentor(mentorId: string, params: BatchQueryParams) {
    const { items, total } = await this.batchRepo.findWithFilters(params, mentorId);
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

  public async getBatchByIdForMentor(batchId: string, mentorId: string) {
    const membership = await this.batchRepo.findActiveMemberInBatch(batchId, mentorId);
    if (!membership || membership.memberRole !== BatchMemberRole.MENTOR) {
      throw new ForbiddenError('You are not an active mentor assigned to this batch');
    }

    return await this.getBatchById(batchId);
  }

  public async getMenteesForMentor(mentorId: string, batchId?: string) {
    const mappings = await this.mentorMenteeRepo.findActiveMappingsForMentor(mentorId, batchId);
    return mappings.map((m) => ({
      id: m.id,
      menteeId: m.menteeId,
      name: m.mentee?.name,
      email: m.mentee?.email,
      batchId: m.batchId,
      batchName: m.batch?.name,
      batchCode: m.batch?.code,
      startDate: m.startDate,
    }));
  }

  // --- Mentee Scoped Endpoints ---

  public async getBatchForMentee(menteeId: string) {
    const membership = await this.batchRepo.findActiveMenteeMembership(menteeId);
    if (!membership) {
      return { batch: null, mentor: null };
    }

    const mapping = await this.mentorMenteeRepo.findActiveMappingForMentee(menteeId);
    return {
      batch: membership.batch,
      mentor: mapping?.mentor
        ? { id: mapping.mentor.id, name: mapping.mentor.name, email: mapping.mentor.email }
        : null,
      joinedAt: membership.joinedAt,
    };
  }
}

export const batchService = new BatchService();
