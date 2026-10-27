import { ForbiddenError, NotFoundError } from '../../core/errors';
import { Batch, BatchMemberRole, BatchStatus } from '../batches';
import { UserRole } from '../users';
import { AllocationsRepository, allocationsRepository } from './allocations.repository';
import { CourseAllocation } from './entities/course-allocation.entity';
import type { AllocationTargetType } from './schemas/allocation.schemas';

export class AllocationsPolicy {
  constructor(private readonly repo: AllocationsRepository = allocationsRepository) {}

  async assertCanAssignCourse(
    actor: { id: string; role: string },
    targetType: AllocationTargetType,
    batchId?: string,
    menteeIds?: string[],
  ): Promise<void> {
    const actorRole = actor.role as UserRole;

    if (actorRole === UserRole.SUPER_ADMIN) {
      if (batchId) {
        await this.assertBatchAssignable(batchId);
      }
      if (menteeIds && menteeIds.length > 0) {
        if (targetType === 'SELECTED_MENTEES' && batchId) {
          await this.assertUsersAreActiveMenteesInBatch(batchId, menteeIds);
        } else {
          await this.assertUsersAreActiveMentees(menteeIds);
        }
      }
      return;
    }

    if (actorRole === UserRole.MENTOR) {
      if (targetType === 'INDIVIDUAL_MENTEES' || !batchId) {
        throw new ForbiddenError(
          'Mentors can only allocate courses to batches where they are an active member',
        );
      }

      await this.assertBatchAssignable(batchId);

      const isMentorInBatch = await this.repo.findBatchMember(
        batchId,
        actor.id,
        BatchMemberRole.MENTOR,
        true,
      );

      if (!isMentorInBatch) {
        throw new ForbiddenError(
          'Mentor cannot assign courses to a batch where they are not an active member',
        );
      }

      if (menteeIds && menteeIds.length > 0) {
        await this.assertUsersAreActiveMenteesInBatch(batchId, menteeIds);
      }
      return;
    }

    throw new ForbiddenError('Only Super Admin and Mentors can allocate courses');
  }

  async assertCanManageAllocation(
    actor: { id: string; role: string },
    allocation: CourseAllocation,
  ): Promise<void> {
    const actorRole = actor.role as UserRole;

    if (actorRole === UserRole.SUPER_ADMIN) {
      return;
    }

    if (actorRole === UserRole.MENTOR) {
      if (!allocation.batchId) {
        throw new ForbiddenError('Mentors cannot manage individual allocations outside batches');
      }

      const isMentorInBatch = await this.repo.findBatchMember(
        allocation.batchId,
        actor.id,
        BatchMemberRole.MENTOR,
        true,
      );

      if (!isMentorInBatch) {
        throw new ForbiddenError(
          'Mentor cannot manage allocations for a batch where they are not an active member',
        );
      }
      return;
    }

    throw new ForbiddenError('Insufficient permissions to manage this course allocation');
  }

  async getMentorAccessibleBatchIds(actor: { id: string; role: string }): Promise<string[] | null> {
    const actorRole = actor.role as UserRole;

    if (actorRole === UserRole.SUPER_ADMIN) {
      return null;
    }

    if (actorRole === UserRole.MENTOR) {
      return await this.repo.findActiveMentorBatchIds(actor.id);
    }

    return [];
  }

  private async assertBatchAssignable(batchId: string): Promise<Batch> {
    const batch = await this.repo.findBatchById(batchId);
    if (!batch) {
      throw new NotFoundError('Target batch not found');
    }

    if (batch.status !== BatchStatus.DRAFT && batch.status !== BatchStatus.LIVE) {
      throw new ForbiddenError(
        `Courses cannot be assigned to batches in ${batch.status} status. Only DRAFT and LIVE batches can receive allocations.`,
      );
    }

    return batch;
  }

  private async assertUsersAreActiveMentees(userIds: string[]): Promise<void> {
    const users = await this.repo.findUsersByIds(userIds);
    const foundIds = new Set(users.map((u) => u.id));
    const missing = userIds.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      throw new NotFoundError(`Mentee(s) not found: ${missing.join(', ')}`);
    }

    for (const user of users) {
      if (user.role !== UserRole.MENTEE) {
        throw new ForbiddenError('Courses can be assigned to mentees only');
      }
      if (!user.isActive) {
        throw new ForbiddenError(
          `User ${user.name} is deactivated and cannot receive course allocations`,
        );
      }
    }
  }

  private async assertUsersAreActiveMenteesInBatch(
    batchId: string,
    menteeIds: string[],
  ): Promise<void> {
    const activeMembers = await this.repo.findActiveBatchMenteesByUserIds(batchId, menteeIds);
    const activeMemberUserIds = new Set(activeMembers.map((m) => m.userId));
    const missing = menteeIds.filter((id) => !activeMemberUserIds.has(id));

    if (missing.length > 0) {
      throw new ForbiddenError(
        `Selected mentee(s) are not active mentee members of the specified batch: ${missing.join(', ')}`,
      );
    }
  }
}

export const allocationsPolicy = new AllocationsPolicy();
