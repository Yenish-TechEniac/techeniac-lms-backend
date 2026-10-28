import type { AuthenticatedUser } from '../../core/auth';
import { ForbiddenError, UnprocessableEntityError, ValidationError } from '../../core/errors';
import { UserRole } from '../users';
import type { Submission } from './entities/submission.entity';
import { gradingRepository } from './grading.repository';

export class GradingPolicy {
  /**
   * Asserts whether an actor can view review details or grade a submission.
   * - Super Admin can review any submission (REV-11).
   * - Mentors can review only submissions for mentees mapped to them in the submission's batch (FR-10.6, REV-02, REV-10).
   * - Completed batches preserve the mapped mentor's grading right (REV-14).
   * - Unmapped submissions or unbatched allocations are scoped only to Super Admin (REV-17, REV-20).
   */
  async assertCanReviewSubmission(
    actor: AuthenticatedUser,
    submission: Submission,
    menteeUserId: string,
  ): Promise<void> {
    const role = actor.role as UserRole;
    if (role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (role !== UserRole.MENTOR) {
      throw new ForbiddenError('Only Mentors and Super Admins can review and grade submissions');
    }

    if (!submission.batchId) {
      throw new ForbiddenError(
        'Access denied: This submission has no assigned batch and is reviewable only by Super Admin',
      );
    }

    // Verify active mapping between mentor and mentee in this batch
    const mapping = await gradingRepository.findActiveMentorMenteeMapping(
      submission.batchId,
      menteeUserId,
      actor.id,
    );

    if (!mapping) {
      throw new ForbiddenError(
        'Access denied: You are not assigned as the mentor for this mentee in this batch',
      );
    }
  }

  /**
   * Validates grading parameters:
   * - Target submission version must be the latest version (REV-22).
   * - Marks must be within [0, maxMarks] (REV-08).
   */
  assertCanGrade(
    submission: Submission,
    latestVersion: number,
    marks: number,
    maxMarks: number,
  ): void {
    if (submission.version !== latestVersion) {
      throw new UnprocessableEntityError(
        `Cannot grade submission version ${submission.version}. Only the latest submission version (${latestVersion}) can be graded.`,
      );
    }

    if (marks < 0 || marks > maxMarks) {
      throw new ValidationError(
        `Marks must be between 0 and the assignment maximum marks of ${maxMarks}`,
      );
    }
  }

  /**
   * Validates resubmission request parameters:
   * - Target submission version must be the latest version (REV-22).
   */
  assertCanRequestResubmission(submission: Submission, latestVersion: number): void {
    if (submission.version !== latestVersion) {
      throw new UnprocessableEntityError(
        `Cannot request resubmission on version ${submission.version}. Only the latest submission version (${latestVersion}) can be modified.`,
      );
    }
  }
}

export const gradingPolicy = new GradingPolicy();
