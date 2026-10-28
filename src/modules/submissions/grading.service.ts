import type { AuthenticatedUser } from '../../core/auth';
import { calculateGradeLabel } from '../../core/config';
import { emailService } from '../../core/email';
import { NotFoundError } from '../../core/errors';
import { logger } from '../../core/logging';
import { UserRole } from '../users';
import { SubmissionStatus } from './entities/submission.entity';
import { gradingPolicy } from './grading.policy';
import { gradingRepository, type PaginatedQueueResult } from './grading.repository';
import type {
  GradeSubmissionInput,
  RequestResubmissionInput,
  SubmissionQueueQuery,
} from './schemas/grading.schemas';

export interface SubmissionReviewDetails {
  id: string;
  courseAllocationId: string;
  assignmentId: string;
  assignmentTitle: string;
  instructions: string | null;
  maxMarks: number;
  passMarks: number;
  courseId: string;
  courseTitle: string;
  topicId: string | null;
  topicTitle: string | null;
  batchId: string | null;
  batchName: string | null;
  version: number;
  submittedAt: Date;
  isLate: boolean;
  status: SubmissionStatus;
  submissionData: {
    pdfUrl?: string | null;
    zipUrl?: string | null;
    linkUrl?: string | null;
  };
  mentee: {
    id: string;
    name: string;
    email: string;
  };
  grading: {
    marks: number | null;
    gradeLabel: string | null;
    feedback: string | null;
    gradedBy: string | null;
    gradedAt: Date | null;
  };
}

export class GradingService {
  async getSubmissionQueue(
    query: SubmissionQueueQuery,
    actor: AuthenticatedUser,
  ): Promise<PaginatedQueueResult> {
    return gradingRepository.getSubmissionQueue(query, actor.role as UserRole, actor.id);
  }

  async getReviewDetails(
    submissionId: string,
    actor: AuthenticatedUser,
  ): Promise<SubmissionReviewDetails> {
    const submission = await gradingRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError('Submission not found');
    }

    const allocation = await gradingRepository.findAllocationWithMentee(
      submission.courseAllocationId,
    );
    if (!allocation || !allocation.user) {
      throw new NotFoundError('Course allocation or mentee record not found');
    }

    await gradingPolicy.assertCanReviewSubmission(actor, submission, allocation.userId);

    const menteeName = allocation.user.name || allocation.user.email;

    return {
      id: submission.id,
      courseAllocationId: submission.courseAllocationId,
      assignmentId: submission.assignmentId,
      assignmentTitle: submission.assignment?.title || '',
      instructions: submission.assignment?.instructions || null,
      maxMarks: Number(submission.assignment?.maxMarks ?? 100),
      passMarks: Number(submission.assignment?.passMarks ?? 0),
      courseId: submission.assignment?.courseId || '',
      courseTitle: submission.assignment?.course?.title || '',
      topicId: submission.assignment?.topicId || null,
      topicTitle: submission.assignment?.topic?.title || null,
      batchId: submission.batchId,
      batchName: submission.batch?.name || null,
      version: submission.version,
      submittedAt: submission.submittedAt,
      isLate: submission.isLate,
      status: submission.status,
      submissionData: {
        pdfUrl: submission.submissionData?.pdfUrl || null,
        zipUrl: submission.submissionData?.zipUrl || null,
        linkUrl: submission.submissionData?.linkUrl || null,
      },
      mentee: {
        id: allocation.userId,
        name: menteeName,
        email: allocation.user.email,
      },
      grading: {
        marks: submission.marks !== null ? Number(submission.marks) : null,
        gradeLabel: submission.gradeLabel,
        feedback: submission.feedback,
        gradedBy: submission.gradedBy,
        gradedAt: submission.gradedAt,
      },
    };
  }

  async gradeSubmission(
    submissionId: string,
    input: GradeSubmissionInput,
    actor: AuthenticatedUser,
  ): Promise<SubmissionReviewDetails> {
    const submission = await gradingRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError('Submission not found');
    }

    const allocation = await gradingRepository.findAllocationWithMentee(
      submission.courseAllocationId,
    );
    if (!allocation || !allocation.user) {
      throw new NotFoundError('Course allocation or mentee record not found');
    }

    await gradingPolicy.assertCanReviewSubmission(actor, submission, allocation.userId);

    const latestVersion = await gradingRepository.findLatestVersionNumber(
      submission.courseAllocationId,
      submission.assignmentId,
    );
    const maxMarks = Number(submission.assignment?.maxMarks ?? 100);

    gradingPolicy.assertCanGrade(
      submission,
      latestVersion ?? submission.version,
      input.marks,
      maxMarks,
    );

    const gradeLabel = calculateGradeLabel(input.marks, maxMarks);

    // Audit logging: capture old -> new state transitions per FR-10.5 & REV-09
    logger.info(
      {
        auditType: 'GRADING',
        action: 'GRADE_SUBMISSION',
        submissionId: submission.id,
        gradedBy: actor.id,
        oldValues: {
          marks: submission.marks !== null ? Number(submission.marks) : null,
          gradeLabel: submission.gradeLabel,
          feedback: submission.feedback,
          status: submission.status,
        },
        newValues: {
          marks: input.marks,
          gradeLabel,
          feedback: input.feedback ?? null,
          status: SubmissionStatus.GRADED,
        },
      },
      'Submission graded successfully',
    );

    // Update row directly (writes on same submission row per FR-10.5)
    submission.marks = input.marks;
    submission.gradeLabel = gradeLabel;
    submission.feedback = input.feedback ?? null;
    submission.status = SubmissionStatus.GRADED;
    submission.gradedBy = actor.id;
    submission.gradedAt = new Date();
    submission.updatedBy = actor.id;

    await gradingRepository.save(submission);

    // Dispatch graded notification email to mentee (non-blocking)
    const menteeName = allocation.user.name || allocation.user.email;
    emailService
      .sendAssignmentGradedEmail({
        to: allocation.user.email,
        recipientName: menteeName,
        assignmentTitle: submission.assignment?.title || 'Assignment',
        courseTitle: submission.assignment?.course?.title || 'Course',
        marks: input.marks,
        maxMarks,
        gradeLabel,
        feedback: input.feedback,
      })
      .catch(() => {});

    return this.getReviewDetails(submissionId, actor);
  }

  async requestResubmission(
    submissionId: string,
    input: RequestResubmissionInput,
    actor: AuthenticatedUser,
  ): Promise<SubmissionReviewDetails> {
    const submission = await gradingRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError('Submission not found');
    }

    const allocation = await gradingRepository.findAllocationWithMentee(
      submission.courseAllocationId,
    );
    if (!allocation || !allocation.user) {
      throw new NotFoundError('Course allocation or mentee record not found');
    }

    await gradingPolicy.assertCanReviewSubmission(actor, submission, allocation.userId);

    const latestVersion = await gradingRepository.findLatestVersionNumber(
      submission.courseAllocationId,
      submission.assignmentId,
    );

    gradingPolicy.assertCanRequestResubmission(submission, latestVersion ?? submission.version);

    logger.info(
      {
        auditType: 'GRADING',
        action: 'REQUEST_RESUBMISSION',
        submissionId: submission.id,
        requestedBy: actor.id,
        previousStatus: submission.status,
        feedback: input.feedback,
      },
      'Resubmission requested on submission',
    );

    submission.status = SubmissionStatus.RESUBMIT_REQUESTED;
    submission.feedback = input.feedback;
    submission.gradedBy = actor.id;
    submission.gradedAt = new Date();
    submission.updatedBy = actor.id;

    await gradingRepository.save(submission);

    const menteeName = allocation.user.name || allocation.user.email;
    emailService
      .sendResubmissionRequestedEmail({
        to: allocation.user.email,
        recipientName: menteeName,
        assignmentTitle: submission.assignment?.title || 'Assignment',
        courseTitle: submission.assignment?.course?.title || 'Course',
        feedback: input.feedback,
      })
      .catch(() => {});

    return this.getReviewDetails(submissionId, actor);
  }
}

export const gradingService = new GradingService();
