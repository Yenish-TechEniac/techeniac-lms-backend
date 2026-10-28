import { Repository } from 'typeorm';

import { AppDataSource } from '../../core/db';
import { CourseAllocation } from '../allocations';
import { MentorMentee } from '../batches';
import { Assignment } from '../courses';
import { User, UserRole } from '../users';
import { Submission, SubmissionStatus } from './entities/submission.entity';
import type { SubmissionQueueQuery } from './schemas/grading.schemas';

export interface SubmissionQueueItem {
  id: string;
  courseAllocationId: string;
  assignmentId: string;
  assignmentTitle: string;
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
  marks: number | null;
  gradeLabel: string | null;
  feedback: string | null;
  gradedBy: string | null;
  gradedAt: Date | null;
  mentee: {
    id: string;
    name: string;
    email: string;
  };
}

export interface PaginatedQueueResult {
  items: SubmissionQueueItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class GradingRepository {
  private get submissionRepo(): Repository<Submission> {
    return AppDataSource.getRepository(Submission);
  }

  private get mentorMenteeRepo(): Repository<MentorMentee> {
    return AppDataSource.getRepository(MentorMentee);
  }

  private get assignmentRepo(): Repository<Assignment> {
    return AppDataSource.getRepository(Assignment);
  }

  private get allocationRepo(): Repository<CourseAllocation> {
    return AppDataSource.getRepository(CourseAllocation);
  }

  async findActiveMentorMenteeMapping(
    batchId: string,
    menteeId: string,
    mentorId: string,
  ): Promise<MentorMentee | null> {
    if (!AppDataSource.isInitialized) return null;
    return this.mentorMenteeRepo.findOne({
      where: {
        batchId,
        menteeId,
        mentorId,
        isActive: true,
      },
    });
  }

  async findSubmissionById(id: string): Promise<Submission | null> {
    return this.submissionRepo.findOne({
      where: { id },
      relations: ['assignment', 'assignment.course', 'assignment.topic', 'batch', 'grader'],
    });
  }

  async findAllocationWithMentee(allocationId: string): Promise<CourseAllocation | null> {
    return this.allocationRepo.findOne({
      where: { id: allocationId },
      relations: ['user'],
    });
  }

  async findLatestVersionNumber(
    courseAllocationId: string,
    assignmentId: string,
  ): Promise<number | null> {
    const sub = await this.submissionRepo.findOne({
      where: { courseAllocationId, assignmentId },
      order: { version: 'DESC' },
      select: ['version'],
    });
    return sub ? sub.version : null;
  }

  async getSubmissionQueue(
    query: SubmissionQueueQuery,
    actorRole: UserRole,
    actorId: string,
  ): Promise<PaginatedQueueResult> {
    const qb = this.submissionRepo
      .createQueryBuilder('sub')
      .innerJoin(CourseAllocation, 'alloc', 'alloc.id = sub.course_allocation_id')
      .innerJoin(User, 'mentee', 'mentee.id = alloc.user_id')
      .innerJoinAndSelect('sub.assignment', 'assignment')
      .leftJoinAndSelect('assignment.course', 'course')
      .leftJoinAndSelect('assignment.topic', 'topic')
      .leftJoinAndSelect('sub.batch', 'batch')
      .where('sub.deletedAt IS NULL');

    // Only return the latest version per allocation + assignment in the queue (REV-04, REV-22)
    qb.andWhere((subQb) => {
      const subQuery = subQb
        .subQuery()
        .select('MAX(s2.version)')
        .from(Submission, 's2')
        .where('s2.course_allocation_id = sub.course_allocation_id')
        .andWhere('s2.assignment_id = sub.assignment_id')
        .andWhere('s2.deleted_at IS NULL')
        .getQuery();
      return `sub.version = ${subQuery}`;
    });

    // Scoping for Mentors: only mapped mentees in the submission's batch (FR-10.6, REV-02, REV-16, REV-18, REV-20)
    if (actorRole === UserRole.MENTOR) {
      qb.andWhere('sub.batchId IS NOT NULL');
      qb.andWhere((subQb) => {
        const mappingExists = subQb
          .subQuery()
          .select('1')
          .from(MentorMentee, 'mm')
          .where('mm.batch_id = sub.batch_id')
          .andWhere('mm.mentee_id = alloc.user_id')
          .andWhere('mm.mentor_id = :actorMentorId')
          .andWhere('mm.is_active = true')
          .andWhere('mm.deleted_at IS NULL')
          .getQuery();
        return `EXISTS (${mappingExists})`;
      });
      qb.setParameter('actorMentorId', actorId);
    }

    // Filter by status (default SUBMITTED / "Pending review" per FR-10.3)
    if (query.status && query.status !== 'ALL') {
      qb.andWhere('sub.status = :statusFilter', { statusFilter: query.status });
    }

    // Filters
    if (query.batchId) {
      qb.andWhere('sub.batchId = :batchId', { batchId: query.batchId });
    }
    if (query.menteeId) {
      qb.andWhere('alloc.userId = :menteeId', { menteeId: query.menteeId });
    }
    if (query.courseId) {
      qb.andWhere('assignment.courseId = :courseId', { courseId: query.courseId });
    }
    if (query.topicId) {
      qb.andWhere('assignment.topicId = :topicId', { topicId: query.topicId });
    }
    if (query.isLate !== undefined) {
      qb.andWhere('sub.isLate = :isLate', { isLate: query.isLate });
    }
    if (query.fromDate) {
      qb.andWhere('sub.submittedAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    }
    if (query.toDate) {
      qb.andWhere('sub.submittedAt <= :toDate', { toDate: new Date(query.toDate) });
    }
    if (query.search) {
      qb.andWhere('(LOWER(mentee.name) LIKE :search OR LOWER(mentee.email) LIKE :search)', {
        search: `%${query.search.toLowerCase()}%`,
      });
    }

    // Select mentee fields directly
    qb.addSelect(['alloc.id', 'alloc.userId', 'mentee.id', 'mentee.name', 'mentee.email']);

    // Sorting: newest first by default, oldest first toggle (FR-10.2, REV-03)
    const direction = query.sort === 'oldest' ? 'ASC' : 'DESC';
    qb.orderBy('sub.submittedAt', direction);

    // Server-side pagination (FR-10.7, REV-15)
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const { raw, entities } = await qb.getRawAndEntities();
    const total = await qb.getCount();

    interface RawQueueRow {
      mentee_id?: unknown;
      mentee_name?: unknown;
      mentee_email?: unknown;
    }

    const rawRows = raw as unknown as RawQueueRow[];
    const items: SubmissionQueueItem[] = entities.map((sub, idx) => {
      const rawRow: RawQueueRow = rawRows[idx] ?? {};
      const menteeName = typeof rawRow.mentee_name === 'string' ? rawRow.mentee_name : '';
      const menteeEmail = typeof rawRow.mentee_email === 'string' ? rawRow.mentee_email : '';
      const menteeId = typeof rawRow.mentee_id === 'string' ? rawRow.mentee_id : '';

      return {
        id: sub.id,
        courseAllocationId: sub.courseAllocationId,
        assignmentId: sub.assignmentId,
        assignmentTitle: sub.assignment?.title || '',
        maxMarks: Number(sub.assignment?.maxMarks ?? 100),
        passMarks: Number(sub.assignment?.passMarks ?? 0),
        courseId: sub.assignment?.courseId || '',
        courseTitle: sub.assignment?.course?.title || '',
        topicId: sub.assignment?.topicId || null,
        topicTitle: sub.assignment?.topic?.title || null,
        batchId: sub.batchId,
        batchName: sub.batch?.name || null,
        version: sub.version,
        submittedAt: sub.submittedAt,
        isLate: sub.isLate,
        status: sub.status,
        marks: sub.marks !== null ? Number(sub.marks) : null,
        gradeLabel: sub.gradeLabel,
        feedback: sub.feedback,
        gradedBy: sub.gradedBy,
        gradedAt: sub.gradedAt,
        mentee: {
          id: menteeId,
          name: menteeName,
          email: menteeEmail,
        },
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async save(submission: Submission): Promise<Submission> {
    return this.submissionRepo.save(submission);
  }
}

export const gradingRepository = new GradingRepository();
