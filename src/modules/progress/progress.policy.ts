import type { AuthenticatedUser } from '../../core/auth';
import { ForbiddenError, ValidationError } from '../../core/errors';
import { CourseAllocation, CourseAllocationStatus } from '../allocations';
import { BatchStatus, MentorScopeAction, mentorScopeHelper } from '../batches';
import { UserRole } from '../users';

export class ProgressPolicy {
  async assertCanViewAllocationProgress(
    actor: AuthenticatedUser,
    allocation: CourseAllocation,
  ): Promise<void> {
    const role = actor.role as UserRole;
    if (role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (role === UserRole.MENTEE) {
      if (allocation.userId !== actor.id) {
        throw new ForbiddenError('Mentees can only view their own course progress');
      }
      return;
    }

    if (role === UserRole.MENTOR) {
      if (!allocation.batchId) {
        throw new ForbiddenError('Mentors cannot view progress for allocations outside batches');
      }

      const inScope = await mentorScopeHelper.canMentorReviewAndTrack(
        actor.id,
        allocation.userId,
        allocation.batchId,
      );

      if (!inScope) {
        throw new ForbiddenError(
          'Mentor can only view progress of mentees mapped to them in this batch',
        );
      }
      return;
    }

    throw new ForbiddenError('Insufficient permissions to view course progress');
  }

  assertCanUpdateTopicStatus(actor: AuthenticatedUser, allocation: CourseAllocation): void {
    const role = actor.role as UserRole;
    if (role !== UserRole.SUPER_ADMIN && role !== UserRole.MENTEE) {
      throw new ForbiddenError('Only the assigned mentee or Super Admin can mark topic status');
    }

    // Read-only freeze for closed, revoked, or completed allocations (FR-8.8, PRG-13)
    if (
      allocation.status === CourseAllocationStatus.COMPLETED ||
      allocation.status === CourseAllocationStatus.REVOKED ||
      allocation.status === CourseAllocationStatus.CLOSED_ROLE_CHANGE ||
      allocation.status === CourseAllocationStatus.CLOSED_BATCH_CHANGE
    ) {
      throw new ForbiddenError(
        'Cannot update topic progress for a completed, revoked, or closed course allocation',
      );
    }

    // Read-only freeze for On hold, Completed, or Archived batches (FR-8.8, PRG-12)
    if (allocation.batch) {
      const batchStatus = allocation.batch.status;
      if (
        batchStatus === BatchStatus.ON_HOLD ||
        batchStatus === BatchStatus.COMPLETED ||
        batchStatus === BatchStatus.ARCHIVED
      ) {
        throw new ForbiddenError(
          `Cannot update topic progress while batch is in ${batchStatus} status`,
        );
      }
    }

    if (role === UserRole.MENTEE && allocation.userId !== actor.id) {
      throw new ForbiddenError('Mentees can only update their own topic progress');
    }
  }

  async assertCanManageTopicDeadline(
    actor: AuthenticatedUser,
    allocation: CourseAllocation,
    deadline: Date,
  ): Promise<void> {
    const role = actor.role as UserRole;
    if (role !== UserRole.SUPER_ADMIN && role !== UserRole.MENTOR) {
      throw new ForbiddenError('Only Super Admin and Mentors can set topic deadlines');
    }

    if (role === UserRole.MENTOR) {
      if (!allocation.batchId) {
        throw new ForbiddenError('Mentors cannot manage topic deadlines outside batches');
      }

      await mentorScopeHelper.requireMentorScope(MentorScopeAction.MANAGE_ALLOCATION, {
        mentorId: actor.id,
        batchId: allocation.batchId,
      });
    }

    // Range validation: start_date <= deadline <= due_date (FR-8.6, PRG-18)
    const start = new Date(allocation.startDate).getTime();
    const due = new Date(allocation.dueDate).getTime();
    const d = deadline.getTime();

    if (d < start || d > due) {
      throw new ValidationError(
        'Topic deadline must fall between the allocation start date and due date',
      );
    }
  }

  async assertCanTrackMentee(
    actor: AuthenticatedUser,
    menteeId: string,
    batchId?: string | null,
  ): Promise<void> {
    const role = actor.role as UserRole;
    if (role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (role === UserRole.MENTOR) {
      if (!batchId) {
        throw new ForbiddenError('Batch context is required for mentor progress tracking');
      }

      const inScope = await mentorScopeHelper.canMentorReviewAndTrack(actor.id, menteeId, batchId);
      if (!inScope) {
        throw new ForbiddenError(
          'Mentor can only track progress of mentees mapped to them in this batch',
        );
      }
      return;
    }

    throw new ForbiddenError('Insufficient permissions to view mentee progress tracker');
  }
}

export const progressPolicy = new ProgressPolicy();
