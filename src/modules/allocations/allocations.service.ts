import type { AuthenticatedUser } from '../../core/auth';
import { isUniqueViolation } from '../../core/db';
import { emailService } from '../../core/email';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/errors';
import { eventBus } from '../../core/lifecycle';
import { logger } from '../../core/logging';
import { BatchStatus } from '../batches';
import { UserRole } from '../users';
import { AllocationsPolicy, allocationsPolicy } from './allocations.policy';
import { AllocationsRepository, allocationsRepository } from './allocations.repository';
import { CourseAllocationStatus } from './entities/allocation.enums';
import { AssignmentDueOverride } from './entities/assignment-due-override.entity';
import { CourseAllocation } from './entities/course-allocation.entity';
import type {
  AddMenteesToAllocationInput,
  AssignmentDueOverrideInput,
  BulkAssignmentDueOverrideInput,
  BulkUpdateAllocationDatesInput,
  CreateAllocationsInput,
  ListAllocationsQuery,
  UpdateAllocationDatesInput,
} from './schemas/allocation.schemas';

export const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

export const TERMINAL_ALLOCATION_STATUSES: readonly CourseAllocationStatus[] = [
  CourseAllocationStatus.COMPLETED,
  CourseAllocationStatus.REVOKED,
  CourseAllocationStatus.CLOSED_ROLE_CHANGE,
  CourseAllocationStatus.CLOSED_BATCH_CHANGE,
];

export interface CreateAllocationsResult {
  created: CourseAllocation[];
  skipped: Array<{ menteeId: string; reason: string }>;
}

export interface BulkUpdateAllocationsResult {
  allocations: CourseAllocation[];
  skipped: Array<{ allocationId: string; reason: string }>;
}

export interface BulkAssignmentDueOverridesResult {
  overrides: AssignmentDueOverride[];
  skipped: Array<{ allocationId: string; reason: string }>;
}

export class AllocationsService {
  constructor(
    private readonly repo: AllocationsRepository = allocationsRepository,
    private readonly policy: AllocationsPolicy = allocationsPolicy,
  ) {}

  async createAllocations(
    input: CreateAllocationsInput,
    actor: AuthenticatedUser,
  ): Promise<CreateAllocationsResult> {
    await this.policy.assertCanAssignCourse(
      actor,
      input.targetType,
      input.batchId,
      input.menteeIds,
    );

    const course = await this.repo.findCourseById(input.courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    if (!course.isActive) {
      throw new ValidationError('Cannot allocate an inactive course');
    }

    const startDate = new Date(input.startDate);
    const dueDate = this.computeDueDate(startDate, input.dueDate, course.estimatedMinutes);

    const { targetMenteeIds, requestSkipped } = await this.resolveTargetMenteeIds(input);
    if (targetMenteeIds.length === 0) {
      return { created: [], skipped: requestSkipped };
    }

    const { eligibleMenteeIds, openAllocationSkipped } = await this.partitionEligibleMentees(
      course.id,
      targetMenteeIds,
    );

    const skipped = [...requestSkipped, ...openAllocationSkipped];

    if (input.targetType === 'INDIVIDUAL_MENTEES' && eligibleMenteeIds.length === 0) {
      throw new ConflictError('Mentee already has an open allocation of the same course');
    }

    if (eligibleMenteeIds.length === 0) {
      return { created: [], skipped };
    }

    const allocationsToCreate: CourseAllocation[] = eligibleMenteeIds.map((menteeId) => {
      const allocation = new CourseAllocation();
      allocation.courseId = course.id;
      allocation.batchId =
        input.targetType === 'INDIVIDUAL_MENTEES' ? null : (input.batchId ?? null);
      allocation.userId = menteeId;
      allocation.startDate = startDate;
      allocation.estimatedMinutes = course.estimatedMinutes;
      allocation.dueDate = dueDate;
      allocation.status = CourseAllocationStatus.ASSIGNED;
      allocation.progressPercent = 0;
      allocation.createdBy = actor.id;
      return allocation;
    });

    let savedAllocations: CourseAllocation[];
    try {
      savedAllocations = await this.repo.transaction(async (manager) => {
        return await this.repo.saveAllocations(allocationsToCreate, manager);
      });
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictError('Mentee already has an open allocation of this course');
      }
      throw err;
    }

    eventBus.emitEvent('allocation.created', {
      allocationIds: savedAllocations.map((a) => a.id),
      courseId: course.id,
    });

    void this.dispatchAllocationEmails(savedAllocations, course.title, input.batchId);

    return {
      created: savedAllocations,
      skipped,
    };
  }

  private computeDueDate(
    startDate: Date,
    inputDueDate?: string,
    estimatedMinutes?: number | null,
  ): Date {
    if (inputDueDate) {
      const dueDate = new Date(inputDueDate);
      if (dueDate.getTime() < startDate.getTime()) {
        throw new ValidationError('Due date earlier than start date');
      }
      return dueDate;
    }

    if (estimatedMinutes && estimatedMinutes > 0) {
      return new Date(startDate.getTime() + estimatedMinutes * 60 * 1000);
    }

    throw new ValidationError('Course has no estimated minutes and no due date entered');
  }

  private async resolveTargetMenteeIds(input: CreateAllocationsInput): Promise<{
    targetMenteeIds: string[];
    requestSkipped: Array<{ menteeId: string; reason: string }>;
  }> {
    if (input.targetType === 'BATCH') {
      const activeMenteeMembers = await this.repo.findActiveBatchMenteeMembers(input.batchId!);
      return {
        targetMenteeIds: activeMenteeMembers.map((m) => m.userId),
        requestSkipped: [],
      };
    }

    const rawMenteeIds = input.menteeIds ?? [];
    const seen = new Set<string>();
    const targetMenteeIds: string[] = [];
    const requestSkipped: Array<{ menteeId: string; reason: string }> = [];

    for (const id of rawMenteeIds) {
      if (seen.has(id)) {
        requestSkipped.push({ menteeId: id, reason: 'Duplicate ID in request' });
      } else {
        seen.add(id);
        targetMenteeIds.push(id);
      }
    }

    return { targetMenteeIds, requestSkipped };
  }

  private async partitionEligibleMentees(
    courseId: string,
    targetMenteeIds: string[],
  ): Promise<{
    eligibleMenteeIds: string[];
    openAllocationSkipped: Array<{ menteeId: string; reason: string }>;
  }> {
    const existingOpenAllocations = await this.repo.findOpenAllocationsForMentees(
      courseId,
      targetMenteeIds,
    );
    const openMenteeIdSet = new Set(existingOpenAllocations.map((a) => a.userId));

    const eligibleMenteeIds: string[] = [];
    const openAllocationSkipped: Array<{ menteeId: string; reason: string }> = [];

    for (const menteeId of targetMenteeIds) {
      if (openMenteeIdSet.has(menteeId)) {
        openAllocationSkipped.push({
          menteeId,
          reason: 'Mentee already has an open allocation of the same course',
        });
      } else {
        eligibleMenteeIds.push(menteeId);
      }
    }

    return { eligibleMenteeIds, openAllocationSkipped };
  }

  private async dispatchAllocationEmails(
    savedAllocations: CourseAllocation[],
    courseTitle: string,
    batchId?: string,
  ): Promise<void> {
    try {
      const [users, batch] = await Promise.all([
        this.repo.findUsersByIds(savedAllocations.map((a) => a.userId)),
        batchId ? this.repo.findBatchById(batchId) : Promise.resolve(null),
      ]);

      for (const alloc of savedAllocations) {
        const user = users.find((u) => u.id === alloc.userId);
        if (user?.email) {
          void emailService.sendCourseAllocatedEmail({
            to: user.email,
            userId: alloc.userId,
            recipientName: user.name,
            courseTitle,
            startDate: alloc.startDate.toISOString().slice(0, 10),
            dueDate: alloc.dueDate.toISOString().slice(0, 10),
            batchName: batch?.name,
          });
        }
      }
    } catch (err: unknown) {
      logger.warn({ err }, 'Failed to dispatch one or more allocation notification emails');
    }
  }

  async listAllocations(query: ListAllocationsQuery, actor: AuthenticatedUser) {
    const actorRole = actor.role as UserRole;

    if (actorRole === UserRole.MENTEE) {
      return await this.repo.listAllocations(query, undefined, actor.id);
    }

    if (actorRole === UserRole.MENTOR) {
      const allowedBatchIds = await this.policy.getMentorAccessibleBatchIds(actor);
      return await this.repo.listAllocations(query, allowedBatchIds, null);
    }

    // SUPER_ADMIN
    return await this.repo.listAllocations(query, null, null);
  }

  async getAllocationById(id: string, actor: AuthenticatedUser): Promise<CourseAllocation> {
    const allocation = await this.repo.findAllocationById(id);
    if (!allocation) {
      throw new NotFoundError('Course allocation not found');
    }

    const actorRole = actor.role as UserRole;
    if (actorRole === UserRole.MENTEE) {
      if (allocation.userId !== actor.id) {
        throw new ForbiddenError('Access denied');
      }
      return allocation;
    }

    await this.policy.assertCanManageAllocation(actor, allocation);
    return allocation;
  }

  async updateAllocationDates(
    id: string,
    input: UpdateAllocationDatesInput,
    actor: AuthenticatedUser,
  ): Promise<CourseAllocation> {
    const allocation = await this.repo.findAllocationById(id);
    if (!allocation) {
      throw new NotFoundError('Course allocation not found');
    }

    if (TERMINAL_ALLOCATION_STATUSES.includes(allocation.status)) {
      throw new BadRequestError('Cannot update dates for a closed or completed allocation');
    }

    await this.policy.assertCanManageAllocation(actor, allocation);

    if (input.startDate) {
      allocation.startDate = new Date(input.startDate);
    }
    if (input.dueDate) {
      allocation.dueDate = new Date(input.dueDate);
    }

    if (new Date(allocation.dueDate).getTime() < new Date(allocation.startDate).getTime()) {
      throw new ValidationError('Due date cannot be earlier than start date');
    }

    allocation.updatedBy = actor.id;
    const saved = await this.repo.saveAllocation(allocation);

    eventBus.emitEvent('allocation.deadlineChanged', {
      allocationId: saved.id,
      dueDate: saved.dueDate.toISOString(),
    });

    if (input.dueDate && saved.user?.email) {
      void emailService.sendCourseDeadlineChangedEmail({
        to: saved.user.email,
        userId: saved.userId,
        recipientName: saved.user.name,
        courseTitle: saved.course?.title ?? 'Allocated Course',
        newDueDate: saved.dueDate.toISOString().slice(0, 10),
      });
    }

    return saved;
  }

  async bulkUpdateAllocationDates(
    input: BulkUpdateAllocationDatesInput,
    actor: AuthenticatedUser,
  ): Promise<BulkUpdateAllocationsResult> {
    const allocations = await this.repo.findAllocationsByIds(input.allocationIds);

    const foundIdSet = new Set(allocations.map((a) => a.id));
    const skipped: Array<{ allocationId: string; reason: string }> = [];

    for (const id of input.allocationIds) {
      if (!foundIdSet.has(id)) {
        skipped.push({ allocationId: id, reason: 'Allocation not found' });
      }
    }

    const validAllocations: CourseAllocation[] = [];
    for (const alloc of allocations) {
      if (TERMINAL_ALLOCATION_STATUSES.includes(alloc.status)) {
        skipped.push({ allocationId: alloc.id, reason: 'Allocation is closed or completed' });
        continue;
      }
      await this.policy.assertCanManageAllocation(actor, alloc);
      validAllocations.push(alloc);
    }

    if (validAllocations.length === 0) {
      return { allocations: [], skipped };
    }

    const updated = await this.repo.transaction(async (manager) => {
      for (const alloc of validAllocations) {
        if (input.startDate) {
          alloc.startDate = new Date(input.startDate);
        }
        if (input.dueDate) {
          alloc.dueDate = new Date(input.dueDate);
        }

        if (new Date(alloc.dueDate).getTime() < new Date(alloc.startDate).getTime()) {
          throw new ValidationError('Due date cannot be earlier than start date');
        }

        alloc.updatedBy = actor.id;
      }
      return await this.repo.saveAllocations(validAllocations, manager);
    });

    for (const alloc of updated) {
      eventBus.emitEvent('allocation.deadlineChanged', {
        allocationId: alloc.id,
        dueDate: alloc.dueDate.toISOString(),
      });
    }

    return { allocations: updated, skipped };
  }

  async revokeAllocation(id: string, actor: AuthenticatedUser): Promise<CourseAllocation> {
    const allocation = await this.repo.findAllocationById(id);
    if (!allocation) {
      throw new NotFoundError('Course allocation not found');
    }

    if (TERMINAL_ALLOCATION_STATUSES.includes(allocation.status)) {
      throw new BadRequestError('Allocation is already closed or completed');
    }

    await this.policy.assertCanManageAllocation(actor, allocation);

    allocation.status = CourseAllocationStatus.REVOKED;
    allocation.updatedBy = actor.id;

    return await this.repo.saveAllocation(allocation);
  }

  async addMenteesToBatchAllocation(
    id: string,
    input: AddMenteesToAllocationInput,
    actor: AuthenticatedUser,
  ): Promise<CreateAllocationsResult> {
    const allocation = await this.repo.findAllocationById(id);
    if (!allocation) {
      throw new NotFoundError('Course allocation not found');
    }

    if (!allocation.batchId) {
      throw new ValidationError('Cannot add mentees to an allocation that has no batch');
    }

    await this.policy.assertCanManageAllocation(actor, allocation);

    return await this.createAllocations(
      {
        courseId: allocation.courseId,
        targetType: 'SELECTED_MENTEES',
        batchId: allocation.batchId,
        menteeIds: input.menteeIds,
        startDate: input.startDate ?? allocation.startDate.toISOString(),
        dueDate: input.dueDate ?? allocation.dueDate.toISOString(),
      },
      actor,
    );
  }

  async setAssignmentDueOverride(
    allocationId: string,
    input: AssignmentDueOverrideInput,
    actor: AuthenticatedUser,
  ): Promise<AssignmentDueOverride> {
    const allocation = await this.repo.findAllocationById(allocationId);
    if (!allocation) {
      throw new NotFoundError('Course allocation not found');
    }

    if (TERMINAL_ALLOCATION_STATUSES.includes(allocation.status)) {
      throw new BadRequestError(
        'Cannot override assignment due date on closed or completed allocation',
      );
    }

    await this.policy.assertCanManageAllocation(actor, allocation);

    let override = await this.repo.findAssignmentOverride(allocationId, input.assignmentId);
    if (!override) {
      override = new AssignmentDueOverride();
      override.courseAllocationId = allocationId;
      override.assignmentId = input.assignmentId;
      override.createdBy = actor.id;
    }

    override.dueDate = new Date(input.dueDate);
    override.setBy = actor.id;
    override.updatedBy = actor.id;

    return await this.repo.saveAssignmentOverride(override);
  }

  async bulkSetAssignmentDueOverrides(
    input: BulkAssignmentDueOverrideInput,
    actor: AuthenticatedUser,
  ): Promise<BulkAssignmentDueOverridesResult> {
    const allocations = await this.repo.findAllocationsByIds(input.allocationIds);

    const foundIdSet = new Set(allocations.map((a) => a.id));
    const skipped: Array<{ allocationId: string; reason: string }> = [];

    for (const id of input.allocationIds) {
      if (!foundIdSet.has(id)) {
        skipped.push({ allocationId: id, reason: 'Allocation not found' });
      }
    }

    const validAllocations: CourseAllocation[] = [];
    for (const alloc of allocations) {
      if (TERMINAL_ALLOCATION_STATUSES.includes(alloc.status)) {
        skipped.push({ allocationId: alloc.id, reason: 'Allocation is closed or completed' });
        continue;
      }
      await this.policy.assertCanManageAllocation(actor, alloc);
      validAllocations.push(alloc);
    }

    if (validAllocations.length === 0) {
      return { overrides: [], skipped };
    }

    const overrides: AssignmentDueOverride[] = [];

    await this.repo.transaction(async (manager) => {
      for (const alloc of validAllocations) {
        let override = await this.repo.findAssignmentOverride(
          alloc.id,
          input.assignmentId,
          manager,
        );
        if (!override) {
          override = new AssignmentDueOverride();
          override.courseAllocationId = alloc.id;
          override.assignmentId = input.assignmentId;
          override.createdBy = actor.id;
        }

        override.dueDate = new Date(input.dueDate);
        override.setBy = actor.id;
        override.updatedBy = actor.id;

        const saved = await this.repo.saveAssignmentOverride(override, manager);
        overrides.push(saved);
      }
    });

    return { overrides, skipped };
  }

  async getAssignmentOverrides(
    allocationId: string,
    actor: AuthenticatedUser,
  ): Promise<AssignmentDueOverride[]> {
    const allocation = await this.repo.findAllocationById(allocationId);
    if (!allocation) {
      throw new NotFoundError('Course allocation not found');
    }

    const actorRole = actor.role as UserRole;
    if (actorRole === UserRole.MENTEE && allocation.userId !== actor.id) {
      throw new ForbiddenError('Access denied');
    }

    if (actorRole === UserRole.MENTOR) {
      await this.policy.assertCanManageAllocation(actor, allocation);
    }

    return await this.repo.findOverridesByAllocationId(allocationId);
  }

  async handleBatchMemberTransferred(payload: {
    batchId: string;
    menteeId: string;
    newBatchId: string;
    actorId?: string;
  }): Promise<void> {
    await this.repo.closeAllocationsForBatchTransfer(
      payload.batchId,
      payload.menteeId,
      payload.actorId,
    );

    const openBatchAllocations = await this.repo.findOpenBatchAllocations(payload.newBatchId);
    const uniqueCourseIds = Array.from(new Set(openBatchAllocations.map((a) => a.courseId)));

    for (const courseId of uniqueCourseIds) {
      const courseAllocations = openBatchAllocations.filter((a) => a.courseId === courseId);
      const latestDueDate = courseAllocations.reduce((max, curr) => {
        return curr.dueDate.getTime() > max.getTime() ? curr.dueDate : max;
      }, new Date(0));

      const course = courseAllocations[0]?.course;
      const minDueDate = new Date(Date.now() + (course?.estimatedMinutes || 0) * 60 * 1000);
      const effectiveDueDate = new Date(Math.max(latestDueDate.getTime(), minDueDate.getTime()));

      if (effectiveDueDate.getTime() > Date.now()) {
        try {
          await this.createAllocations(
            {
              courseId,
              targetType: 'SELECTED_MENTEES',
              batchId: payload.newBatchId,
              menteeIds: [payload.menteeId],
              startDate: new Date().toISOString(),
              dueDate: effectiveDueDate.toISOString(),
            },
            {
              id: payload.actorId ?? SYSTEM_ACTOR_ID,
              role: 'SUPER_ADMIN',
              email: 'system@internal.lms',
              name: 'System',
              mustChangePassword: false,
              tokenVersion: 1,
            },
          );
        } catch (err: unknown) {
          logger.warn(
            { err, courseId, menteeId: payload.menteeId },
            'Failed auto-reallocation on batch member transferred event',
          );
        }
      }
    }
  }

  async handleBatchMemberJoined(payload: {
    batchId: string;
    userId: string;
    role: string;
    actorId?: string;
  }): Promise<void> {
    if ((payload.role as UserRole) !== UserRole.MENTEE) {
      return;
    }

    const batch = await this.repo.findBatchById(payload.batchId);
    if (!batch || batch.status !== BatchStatus.LIVE) {
      return;
    }

    const openBatchAllocations = await this.repo.findOpenBatchAllocations(payload.batchId);
    const uniqueCourseIds = Array.from(new Set(openBatchAllocations.map((a) => a.courseId)));

    for (const courseId of uniqueCourseIds) {
      const courseAllocations = openBatchAllocations.filter((a) => a.courseId === courseId);
      const latestDueDate = courseAllocations.reduce((max, curr) => {
        return curr.dueDate.getTime() > max.getTime() ? curr.dueDate : max;
      }, new Date(0));

      const course = courseAllocations[0]?.course;
      const minDueDate = new Date(Date.now() + (course?.estimatedMinutes || 0) * 60 * 1000);
      const effectiveDueDate = new Date(Math.max(latestDueDate.getTime(), minDueDate.getTime()));

      if (effectiveDueDate.getTime() > Date.now()) {
        try {
          await this.createAllocations(
            {
              courseId,
              targetType: 'SELECTED_MENTEES',
              batchId: payload.batchId,
              menteeIds: [payload.userId],
              startDate: new Date().toISOString(),
              dueDate: effectiveDueDate.toISOString(),
            },
            {
              id: payload.actorId ?? SYSTEM_ACTOR_ID,
              role: 'SUPER_ADMIN',
              email: 'system@internal.lms',
              name: 'System',
              mustChangePassword: false,
              tokenVersion: 1,
            },
          );
        } catch (err: unknown) {
          logger.warn(
            { err, courseId, menteeId: payload.userId },
            'Failed auto-reallocation on batch member joined event',
          );
        }
      }
    }
  }

  async handleUserRoleChanged(payload: {
    userId: string;
    newRole: string;
    actorId?: string;
  }): Promise<void> {
    if ((payload.newRole as UserRole) !== UserRole.MENTEE) {
      await this.repo.closeAllocationsForRoleChange(payload.userId, payload.actorId);
    }
  }
}

export const allocationsService = new AllocationsService();
