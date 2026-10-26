import { ForbiddenError } from '../../core/errors';
import { BatchRepository, batchRepository } from './batch.repository';
import { BatchMemberRole } from './entities/batch.enums';
import { MentorMenteeRepository, mentorMenteeRepository } from './mentor-mentee.repository';

export enum MentorScopeAction {
  ASSIGN_COURSE = 'ASSIGN_COURSE',
  MANAGE_ALLOCATION = 'MANAGE_ALLOCATION',
  REVIEW_AND_TRACK = 'REVIEW_AND_TRACK',
}

export interface CheckMentorScopeParams {
  mentorId: string;
  batchId: string;
  menteeId?: string;
}

/**
 * Reusable Mentor Scope Helper (PRD Section 2.1)
 *
 * Enforces single source of truth for mentor permissions across the platform:
 * 1. Assign course: Mentor must be an active member of the batch, and mentee must be an active mentee of that batch.
 * 2. Manage allocation (due dates, overrides, deadlines): Allocation's batchId must be a batch where mentor is an active member.
 * 3. Review, grade, track progress, view performance: Mentee must have an active mapping to the mentor in batch B (mentor_mentees.batch_id = B).
 */
export class MentorScopeHelper {
  constructor(
    private readonly batchRepo: BatchRepository = batchRepository,
    private readonly mentorMenteeRepo: MentorMenteeRepository = mentorMenteeRepository,
  ) {}

  /**
   * Action 1: Assign course
   * Mentor can act on: Any mentee who is an active member of a batch where he is an active member.
   */
  public async canMentorAssignCourse(
    mentorId: string,
    menteeId: string,
    batchId: string,
  ): Promise<boolean> {
    const mentorMembership = await this.batchRepo.findActiveMemberInBatch(batchId, mentorId);
    if (!mentorMembership || mentorMembership.memberRole !== BatchMemberRole.MENTOR) {
      return false;
    }

    const menteeMembership = await this.batchRepo.findActiveMemberInBatch(batchId, menteeId);
    if (!menteeMembership || menteeMembership.memberRole !== BatchMemberRole.MENTEE) {
      return false;
    }

    return true;
  }

  /**
   * Action 2: Change allocation due date, assignment due-date overrides, topic deadlines
   * Mentor can act on: Allocations whose batch_id is a batch where he is an active member.
   */
  public async canMentorManageAllocation(mentorId: string, batchId: string): Promise<boolean> {
    const mentorMembership = await this.batchRepo.findActiveMemberInBatch(batchId, mentorId);
    return Boolean(mentorMembership && mentorMembership.memberRole === BatchMemberRole.MENTOR);
  }

  /**
   * Action 3: Review, grade, track progress, view performance
   * Mentor can act on: Mentees with an active mapping to him in batch B (mentor_mentees.batch_id = B),
   * limited to that batch's submissions and allocations.
   */
  public async canMentorReviewAndTrack(
    mentorId: string,
    menteeId: string,
    batchId: string,
  ): Promise<boolean> {
    const mapping = await this.mentorMenteeRepo.findActiveByMenteeAndBatch(batchId, menteeId);
    if (!mapping || !mapping.isActive || mapping.mentorId !== mentorId) {
      return false;
    }

    // Verify mentor still has active batch membership access (Section 2.1)
    const mentorMembership = await this.batchRepo.findActiveMemberInBatch(batchId, mentorId);
    if (!mentorMembership) {
      return false;
    }

    return true;
  }

  /**
   * Assertive helper that throws ForbiddenError (HTTP 403) when mentor is not in scope.
   */
  public async requireMentorScope(
    action: MentorScopeAction,
    params: CheckMentorScopeParams,
  ): Promise<void> {
    let allowed = false;

    switch (action) {
      case MentorScopeAction.ASSIGN_COURSE: {
        if (!params.menteeId) {
          throw new ForbiddenError('Mentee ID is required to verify course assignment scope');
        }
        allowed = await this.canMentorAssignCourse(
          params.mentorId,
          params.menteeId,
          params.batchId,
        );
        break;
      }
      case MentorScopeAction.MANAGE_ALLOCATION: {
        allowed = await this.canMentorManageAllocation(params.mentorId, params.batchId);
        break;
      }
      case MentorScopeAction.REVIEW_AND_TRACK: {
        if (!params.menteeId) {
          throw new ForbiddenError('Mentee ID is required to verify review/tracking scope');
        }
        allowed = await this.canMentorReviewAndTrack(
          params.mentorId,
          params.menteeId,
          params.batchId,
        );
        break;
      }
    }

    if (!allowed) {
      throw new ForbiddenError(
        'Operation denied: mentor is not within required batch/mentee scope',
      );
    }
  }
}

export const mentorScopeHelper = new MentorScopeHelper();
