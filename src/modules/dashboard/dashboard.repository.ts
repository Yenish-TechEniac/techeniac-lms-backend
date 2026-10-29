import { DataSource, In, IsNull, Repository } from 'typeorm';

import { AppDataSource } from '../../core/db';
import { CourseAllocation, CourseAllocationStatus } from '../allocations';
import { Batch, BatchMember, BatchMemberRole, BatchStatus, MentorMentee } from '../batches';
import { Assignment, Course } from '../courses';
import { Submission, SubmissionStatus } from '../submissions';
import { User, UserRole } from '../users';
import type {
  AdminDashboardResponse,
  LatestSubmissionItem,
  MenteeRecentSubmissionItem,
  MenteeUpcomingDeadlineItem,
} from './schemas/dashboard.schemas';

export class DashboardRepository {
  private readonly userRepo: Repository<User>;
  private readonly batchRepo: Repository<Batch>;
  private readonly batchMemberRepo: Repository<BatchMember>;
  private readonly mentorMenteeRepo: Repository<MentorMentee>;
  private readonly courseRepo: Repository<Course>;
  private readonly allocationRepo: Repository<CourseAllocation>;
  private readonly submissionRepo: Repository<Submission>;

  constructor(dataSource: DataSource = AppDataSource) {
    this.userRepo = dataSource.getRepository(User);
    this.batchRepo = dataSource.getRepository(Batch);
    this.batchMemberRepo = dataSource.getRepository(BatchMember);
    this.mentorMenteeRepo = dataSource.getRepository(MentorMentee);
    this.courseRepo = dataSource.getRepository(Course);
    this.allocationRepo = dataSource.getRepository(CourseAllocation);
    this.submissionRepo = dataSource.getRepository(Submission);
  }

  public async getAdminMetrics(): Promise<AdminDashboardResponse> {
    const [
      usersByRole,
      batchesByStatus,
      totalCourses,
      publishedCourses,
      allocationsByStatus,
      submissionsByStatus,
    ] = await Promise.all([
      this.userRepo
        .createQueryBuilder('u')
        .select('u.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .where('u.deletedAt IS NULL')
        .andWhere('u.isActive = true')
        .groupBy('u.role')
        .getRawMany<{ role: string; count: string }>(),

      this.batchRepo
        .createQueryBuilder('b')
        .select('b.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('b.deletedAt IS NULL')
        .groupBy('b.status')
        .getRawMany<{ status: string; count: string }>(),

      this.courseRepo.count({ where: { deletedAt: IsNull() } }),
      this.courseRepo.count({ where: { deletedAt: IsNull(), isActive: true } }),

      this.allocationRepo
        .createQueryBuilder('ca')
        .select('ca.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('ca.deletedAt IS NULL')
        .groupBy('ca.status')
        .getRawMany<{ status: string; count: string }>(),

      this.submissionRepo
        .createQueryBuilder('s')
        .select('s.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('s.deletedAt IS NULL')
        .groupBy('s.status')
        .getRawMany<{ status: string; count: string }>(),
    ]);

    const roleMap = new Map(usersByRole.map((r) => [r.role, Number(r.count)]));
    const batchMap = new Map(batchesByStatus.map((b) => [b.status, Number(b.count)]));
    const allocMap = new Map(allocationsByStatus.map((a) => [a.status, Number(a.count)]));
    const subMap = new Map(submissionsByStatus.map((s) => [s.status, Number(s.count)]));

    const menteesCount = roleMap.get(UserRole.MENTEE) ?? 0;
    const mentorsCount = roleMap.get(UserRole.MENTOR) ?? 0;
    const adminsCount = roleMap.get(UserRole.SUPER_ADMIN) ?? 0;
    const totalUsers = menteesCount + mentorsCount + adminsCount;

    const liveBatches = batchMap.get(BatchStatus.LIVE) ?? 0;
    const draftBatches = batchMap.get(BatchStatus.DRAFT) ?? 0;
    const completedBatches = batchMap.get(BatchStatus.COMPLETED) ?? 0;
    const totalBatches = Array.from(batchMap.values()).reduce((a, b) => a + b, 0);

    const activeAllocations =
      (allocMap.get(CourseAllocationStatus.ASSIGNED) ?? 0) +
      (allocMap.get(CourseAllocationStatus.IN_PROGRESS) ?? 0);
    const completedAllocations = allocMap.get(CourseAllocationStatus.COMPLETED) ?? 0;

    const pendingReviewCount = subMap.get(SubmissionStatus.SUBMITTED) ?? 0;
    const gradedCount = subMap.get(SubmissionStatus.GRADED) ?? 0;
    const resubmitRequestedCount = subMap.get(SubmissionStatus.RESUBMIT_REQUESTED) ?? 0;

    return {
      users: {
        totalUsers,
        menteesCount,
        mentorsCount,
        adminsCount,
      },
      batches: {
        totalBatches,
        liveBatches,
        draftBatches,
        completedBatches,
      },
      courses: {
        totalCourses,
        publishedCourses,
      },
      allocations: {
        activeAllocations,
        completedAllocations,
      },
      submissions: {
        pendingReviewCount,
        gradedCount,
        resubmitRequestedCount,
      },
    };
  }

  public async getMentorAssignedBatchesCount(mentorId: string): Promise<number> {
    const raw = await this.batchMemberRepo
      .createQueryBuilder('bm')
      .innerJoin(Batch, 'b', 'b.id = bm.batch_id AND b.deleted_at IS NULL')
      .where('bm.userId = :mentorId', { mentorId })
      .andWhere('bm.memberRole = :role', { role: BatchMemberRole.MENTOR })
      .andWhere('bm.isActive = true')
      .andWhere('bm.deletedAt IS NULL')
      .select('COUNT(DISTINCT bm.batchId)', 'count')
      .getRawOne<{ count: string }>();

    return raw ? Number(raw.count) : 0;
  }

  public async getMentorActiveMappings(mentorId: string): Promise<MentorMentee[]> {
    return this.mentorMenteeRepo.find({
      where: {
        mentorId,
        isActive: true,
        deletedAt: IsNull(),
      },
    });
  }

  public async getMentorSubmissionsStats(
    allowedPairs: Array<{ batchId: string; menteeId: string }>,
  ): Promise<{ pendingReviewCount: number; gradedCount: number }> {
    if (allowedPairs.length === 0) {
      return { pendingReviewCount: 0, gradedCount: 0 };
    }

    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .innerJoin(CourseAllocation, 'ca', 'ca.id = s.course_allocation_id AND ca.deleted_at IS NULL')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('s.deletedAt IS NULL')
      .andWhere('s.batchId IS NOT NULL');

    const pairClauses = allowedPairs.map((p, idx) => {
      qb.setParameter(`mb_${idx}`, p.batchId);
      qb.setParameter(`mm_${idx}`, p.menteeId);
      return `(s.batchId = :mb_${idx} AND ca.userId = :mm_${idx})`;
    });
    qb.andWhere(`(${pairClauses.join(' OR ')})`);
    qb.groupBy('s.status');

    const results = await qb.getRawMany<{ status: string; count: string }>();
    const map = new Map(results.map((r) => [r.status, Number(r.count)]));

    return {
      pendingReviewCount: map.get(SubmissionStatus.SUBMITTED) ?? 0,
      gradedCount: map.get(SubmissionStatus.GRADED) ?? 0,
    };
  }

  public async getMentorLatestSubmissions(
    allowedPairs: Array<{ batchId: string; menteeId: string }>,
    limit: number = 10,
  ): Promise<LatestSubmissionItem[]> {
    if (allowedPairs.length === 0) {
      return [];
    }

    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .innerJoin(CourseAllocation, 'ca', 'ca.id = s.course_allocation_id AND ca.deleted_at IS NULL')
      .innerJoin(Assignment, 'a', 'a.id = s.assignment_id AND a.deleted_at IS NULL')
      .innerJoin(Course, 'c', 'c.id = ca.course_id AND c.deleted_at IS NULL')
      .innerJoin(User, 'u', 'u.id = ca.user_id AND u.deleted_at IS NULL')
      .leftJoin(Batch, 'b', 'b.id = s.batch_id AND b.deleted_at IS NULL')
      .select([
        's.id AS "id"',
        's.assignment_id AS "assignmentId"',
        'a.title AS "assignmentTitle"',
        'ca.course_id AS "courseId"',
        'c.title AS "courseName"',
        'ca.user_id AS "menteeId"',
        'u.name AS "menteeName"',
        'u.email AS "menteeEmail"',
        's.batch_id AS "batchId"',
        'b.name AS "batchName"',
        's.version AS "version"',
        's.status AS "status"',
        's.is_late AS "isLate"',
        's.submitted_at AS "submittedAt"',
      ])
      .where('s.deletedAt IS NULL')
      .andWhere('s.batchId IS NOT NULL');

    const pairClauses = allowedPairs.map((p, idx) => {
      qb.setParameter(`lb_${idx}`, p.batchId);
      qb.setParameter(`lm_${idx}`, p.menteeId);
      return `(s.batchId = :lb_${idx} AND ca.userId = :lm_${idx})`;
    });
    qb.andWhere(`(${pairClauses.join(' OR ')})`);
    qb.orderBy('s.submitted_at', 'DESC');
    qb.limit(limit);

    const rows = await qb.getRawMany<{
      id: string;
      assignmentId: string;
      assignmentTitle: string;
      courseId: string;
      courseName: string;
      menteeId: string;
      menteeName: string;
      menteeEmail: string;
      batchId: string | null;
      batchName: string | null;
      version: number;
      status: string;
      isLate: boolean;
      submittedAt: Date;
    }>();

    return rows.map((r) => ({
      id: r.id,
      assignmentId: r.assignmentId,
      assignmentTitle: r.assignmentTitle,
      courseId: r.courseId,
      courseName: r.courseName,
      menteeId: r.menteeId,
      menteeName: r.menteeName,
      menteeEmail: r.menteeEmail,
      batchId: r.batchId,
      batchName: r.batchName,
      version: Number(r.version),
      status: r.status,
      isLate: Boolean(r.isLate),
      submittedAt: new Date(r.submittedAt).toISOString(),
    }));
  }

  public async getMenteeAllocationsSummary(menteeId: string): Promise<{
    activeCoursesCount: number;
    completedCoursesCount: number;
    overallProgressPercent: number;
  }> {
    const allocations = await this.allocationRepo.find({
      where: {
        userId: menteeId,
        deletedAt: IsNull(),
      },
    });

    const activeAllocations = allocations.filter(
      (a) =>
        a.status === CourseAllocationStatus.ASSIGNED ||
        a.status === CourseAllocationStatus.IN_PROGRESS,
    );
    const completedAllocations = allocations.filter(
      (a) => a.status === CourseAllocationStatus.COMPLETED,
    );

    let overallProgressPercent = 0;
    if (activeAllocations.length > 0) {
      const sum = activeAllocations.reduce((acc, a) => acc + Number(a.progressPercent || 0), 0);
      overallProgressPercent = Math.round((sum / activeAllocations.length) * 10) / 10;
    }

    return {
      activeCoursesCount: activeAllocations.length,
      completedCoursesCount: completedAllocations.length,
      overallProgressPercent,
    };
  }

  public async getMenteePendingAssignmentsCount(menteeId: string): Promise<number> {
    const raw = await this.submissionRepo
      .createQueryBuilder('s')
      .innerJoin(CourseAllocation, 'ca', 'ca.id = s.course_allocation_id AND ca.deleted_at IS NULL')
      .where('ca.userId = :menteeId', { menteeId })
      .andWhere('s.deletedAt IS NULL')
      .andWhere('s.status IN (:...statuses)', {
        statuses: [SubmissionStatus.SUBMITTED, SubmissionStatus.RESUBMIT_REQUESTED],
      })
      .select('COUNT(*)', 'count')
      .getRawOne<{ count: string }>();

    return raw ? Number(raw.count) : 0;
  }

  public async getMenteeRecentSubmissions(
    menteeId: string,
    limit: number = 5,
  ): Promise<MenteeRecentSubmissionItem[]> {
    const rows = await this.submissionRepo
      .createQueryBuilder('s')
      .innerJoin(CourseAllocation, 'ca', 'ca.id = s.course_allocation_id AND ca.deleted_at IS NULL')
      .innerJoin(Assignment, 'a', 'a.id = s.assignment_id AND a.deleted_at IS NULL')
      .innerJoin(Course, 'c', 'c.id = ca.course_id AND c.deleted_at IS NULL')
      .select([
        's.id AS "id"',
        's.assignment_id AS "assignmentId"',
        'a.title AS "assignmentTitle"',
        'c.title AS "courseName"',
        's.status AS "status"',
        's.marks AS "marks"',
        's.grade_label AS "gradeLabel"',
        's.is_late AS "isLate"',
        's.submitted_at AS "submittedAt"',
      ])
      .where('ca.userId = :menteeId', { menteeId })
      .andWhere('s.deletedAt IS NULL')
      .orderBy('s.submitted_at', 'DESC')
      .limit(limit)
      .getRawMany<{
        id: string;
        assignmentId: string;
        assignmentTitle: string;
        courseName: string;
        status: string;
        marks: string | number | null;
        gradeLabel: string | null;
        isLate: boolean;
        submittedAt: Date;
      }>();

    return rows.map((r) => ({
      id: r.id,
      assignmentId: r.assignmentId,
      assignmentTitle: r.assignmentTitle,
      courseName: r.courseName,
      status: r.status,
      marks: r.marks !== null && r.marks !== undefined ? Number(r.marks) : null,
      gradeLabel: r.gradeLabel,
      isLate: Boolean(r.isLate),
      submittedAt: new Date(r.submittedAt).toISOString(),
    }));
  }

  public async getMenteeUpcomingDeadlines(
    menteeId: string,
    limit: number = 5,
  ): Promise<MenteeUpcomingDeadlineItem[]> {
    const allocations = await this.allocationRepo.find({
      where: {
        userId: menteeId,
        status: In([CourseAllocationStatus.ASSIGNED, CourseAllocationStatus.IN_PROGRESS]),
        deletedAt: IsNull(),
      },
      relations: ['course'],
      order: {
        dueDate: 'ASC',
      },
      take: limit,
    });

    const now = new Date();
    return allocations.map((a) => ({
      allocationId: a.id,
      courseName: a.course?.title ?? 'Assigned Course',
      dueDate: new Date(a.dueDate).toISOString(),
      progressPercent: Number(a.progressPercent || 0),
      isOverdue: new Date(a.dueDate) < now,
    }));
  }
}

export const dashboardRepository = new DashboardRepository();
