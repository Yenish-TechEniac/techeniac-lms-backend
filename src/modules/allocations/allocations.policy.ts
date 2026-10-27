import { ForbiddenError, NotFoundError } from '../../core/errors';
import { Batch, BatchMemberRole, BatchStatus } from '../batches';
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
    if (actor.role === 'SUPER_ADMIN') {
      if (batchId) {
        await this.assertBatchAssignable(batchId);
      }
      if (menteeIds && menteeIds.length > 0) {
        await this.assertUsersAreActiveMentees(menteeIds);
      }
      return;
    }

    if (actor.role === 'MENTOR') {
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
    if (actor.role === 'SUPER_ADMIN') {
      return;
    }

    if (actor.role === 'MENTOR') {
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
    if (actor.role === 'SUPER_ADMIN') {
      return null;
    }

    if (actor.role === 'MENTOR') {
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
    for (const user of users) {
      if ((user.role as string) !== 'MENTEE') {
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
    for (const menteeId of menteeIds) {
      const member = await this.repo.findBatchMember(
        batchId,
        menteeId,
        BatchMemberRole.MENTEE,
        true,
      );

      if (!member) {
        throw new ForbiddenError(
          'Selected mentee is not an active mentee member of the specified batch',
        );
      }
    }
  }
}

export const allocationsPolicy = new AllocationsPolicy();
