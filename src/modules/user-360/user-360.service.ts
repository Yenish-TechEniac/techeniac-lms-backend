import { NotFoundError } from '../../core/errors';
import type { CourseAllocation } from '../allocations';
import type { BatchMember, MentorMentee } from '../batches';
import type { Submission } from '../submissions';
import { SubmissionStatus } from '../submissions';
import type { SafeUser, UserRoleHistory } from '../users';
import { toSafeUser, UserRole } from '../users';
import { User360Repository, user360Repository } from './user-360.repository';
import type { User360ExportParams, User360QueryParams, User360Tab } from './user-360.schemas';

export interface RoleHistoryItem {
  id: string;
  role: UserRole;
  fromAt: Date;
  toAt: Date | null;
  reason: string;
  changedBy: string | null;
  periodLabel: string;
}

export interface BatchHistoryItem {
  id: string;
  batchId: string;
  batchName: string;
  batchCode: string;
  role: string;
  joinedAt: Date;
  leftAt: Date | null;
  reasonToLeave: string | null;
  isActive: boolean;
  periodLabel: string;
}

export interface MentorMappingItem {
  id: string;
  batchId: string;
  batchCode: string;
  mappedRole: 'MENTOR' | 'MENTEE';
  peerId: string;
  peerName: string;
  peerEmail: string;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  endReason: string | null;
  periodLabel: string;
}

export interface CourseHistoryItem {
  id: string;
  courseId: string;
  courseTitle: string;
  batchId: string | null;
  batchCode: string | null;
  status: string;
  startDate: Date;
  dueDate: Date;
  completedAt: Date | null;
  progressPercent: number;
  periodLabel: string;
}

export interface SubmissionHistoryItem {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  courseAllocationId: string;
  batchId: string | null;
  version: number;
  status: string;
  submittedAt: Date;
  isLate: boolean;
  marks: number | null;
  gradeLabel: string | null;
  feedback: string | null;
  gradedAt: Date | null;
  graderName: string | null;
  periodLabel: string;
}

export interface PerformanceSummary {
  totalAllocations: number;
  completedAllocations: number;
  inProgressAllocations: number;
  averageProgressPercent: number;
  totalSubmissions: number;
  gradedSubmissions: number;
  averageMarks: number | null;
  onTimeSubmissions: number;
  lateSubmissions: number;
  onTimeRatePercent: number;
  gradeDistribution: Record<string, number>;
}

export interface AuditHistoryItem {
  id: string;
  type: string;
  action: string;
  timestamp: Date;
  actorId: string | null;
  details: Record<string, unknown>;
  periodLabel: string;
}

export interface User360Profile {
  user: SafeUser;
  tabs: {
    profile: SafeUser;
    roleHistory: RoleHistoryItem[];
    batchHistory: BatchHistoryItem[];
    mentorMappingHistory: MentorMappingItem[];
    courseHistory: CourseHistoryItem[];
    assignmentGradeHistory: SubmissionHistoryItem[];
    performanceSummary: PerformanceSummary;
    audit: AuditHistoryItem[];
  };
}

export class User360Service {
  constructor(private readonly repository: User360Repository = user360Repository) {}

  public async getUser360(
    userId: string,
    query: User360QueryParams,
  ): Promise<Partial<User360Profile> | User360Profile> {
    const user = await this.repository.getUser(userId);
    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found`);
    }

    const safeUser = toSafeUser(user);
    const roleHistory = await this.repository.getRoleHistory(userId);
    const batchMemberships = await this.repository.getBatchMemberships(userId);
    const mentorMappings = await this.repository.getMentorMappings(userId);
    const courseAllocations = await this.repository.getCourseAllocations(userId);
    const submissions = await this.repository.getSubmissions(userId);

    const fullProfile = this.aggregateProfile(
      safeUser,
      roleHistory,
      batchMemberships,
      mentorMappings,
      courseAllocations,
      submissions,
      query,
    );

    if (query.tab && query.tab !== 'all') {
      return this.filterByTab(fullProfile, query.tab);
    }

    return fullProfile;
  }

  public async exportUser360Csv(userId: string, query: User360ExportParams): Promise<string> {
    const profile = (await this.getUser360(userId, {
      ...query,
      tab: 'all',
    })) as User360Profile;

    const lines: string[] = [];

    // 1. Profile Section
    lines.push('--- USER 360 PROFILE ---');
    lines.push(`Name,${this.escapeCsv(profile.user.name)}`);
    lines.push(`Email,${this.escapeCsv(profile.user.email)}`);
    lines.push(`Current Role,${profile.user.role}`);
    lines.push(`Status,${profile.user.isActive ? 'Active' : 'Inactive'}`);
    lines.push(`Created At,${profile.user.createdAt.toISOString()}`);
    lines.push('');

    // 2. Role History
    lines.push('--- ROLE HISTORY ---');
    lines.push('Role,From,To,Reason,Period');
    for (const r of profile.tabs.roleHistory) {
      lines.push(
        `${r.role},${r.fromAt.toISOString()},${r.toAt ? r.toAt.toISOString() : 'Present'},${this.escapeCsv(r.reason)},${this.escapeCsv(r.periodLabel)}`,
      );
    }
    lines.push('');

    // 3. Batch History
    lines.push('--- BATCH HISTORY ---');
    lines.push('Batch Name,Batch Code,Role,Joined At,Left At,Reason To Leave,Status,Period');
    for (const b of profile.tabs.batchHistory) {
      lines.push(
        `${this.escapeCsv(b.batchName)},${b.batchCode},${b.role},${b.joinedAt.toISOString()},${b.leftAt ? b.leftAt.toISOString() : ''},${this.escapeCsv(b.reasonToLeave ?? '')},${b.isActive ? 'Active' : 'Left'},${this.escapeCsv(b.periodLabel)}`,
      );
    }
    lines.push('');

    // 4. Mentor Mappings
    lines.push('--- MENTOR MAPPINGS ---');
    lines.push('Batch Code,User Role In Mapping,Peer Name,Peer Email,Start Date,End Date,Status');
    for (const m of profile.tabs.mentorMappingHistory) {
      lines.push(
        `${m.batchCode},${m.mappedRole},${this.escapeCsv(m.peerName)},${m.peerEmail},${m.startDate.toISOString()},${m.endDate ? m.endDate.toISOString() : ''},${m.isActive ? 'Active' : 'Ended'}`,
      );
    }
    lines.push('');

    // 5. Course Allocations
    lines.push('--- COURSE HISTORY ---');
    lines.push('Course Title,Batch,Status,Start Date,Due Date,Progress %,Completed At,Period');
    for (const c of profile.tabs.courseHistory) {
      lines.push(
        `${this.escapeCsv(c.courseTitle)},${c.batchCode ?? 'N/A'},${c.status},${c.startDate.toISOString()},${c.dueDate.toISOString()},${c.progressPercent}%,${c.completedAt ? c.completedAt.toISOString() : ''},${this.escapeCsv(c.periodLabel)}`,
      );
    }
    lines.push('');

    // 6. Submissions & Grades
    lines.push('--- ASSIGNMENT & GRADE HISTORY ---');
    lines.push('Assignment,Version,Status,Submitted At,Is Late,Marks,Grade,Grader,Feedback');
    for (const s of profile.tabs.assignmentGradeHistory) {
      lines.push(
        `${this.escapeCsv(s.assignmentTitle)},${s.version},${s.status},${s.submittedAt.toISOString()},${s.isLate ? 'YES' : 'NO'},${s.marks ?? ''},${s.gradeLabel ?? ''},${this.escapeCsv(s.graderName ?? '')},${this.escapeCsv(s.feedback ?? '')}`,
      );
    }
    lines.push('');

    // 7. Performance Summary
    lines.push('--- PERFORMANCE SUMMARY ---');
    lines.push(`Total Allocations,${profile.tabs.performanceSummary.totalAllocations}`);
    lines.push(`Completed Allocations,${profile.tabs.performanceSummary.completedAllocations}`);
    lines.push(
      `Average Progress,${profile.tabs.performanceSummary.averageProgressPercent.toFixed(1)}%`,
    );
    lines.push(`Total Submissions,${profile.tabs.performanceSummary.totalSubmissions}`);
    lines.push(`Graded Submissions,${profile.tabs.performanceSummary.gradedSubmissions}`);
    lines.push(
      `Average Marks,${profile.tabs.performanceSummary.averageMarks !== null ? profile.tabs.performanceSummary.averageMarks.toFixed(1) : 'N/A'}`,
    );
    lines.push(
      `On-Time Submission Rate,${profile.tabs.performanceSummary.onTimeRatePercent.toFixed(1)}%`,
    );
    lines.push('');

    return lines.join('\n');
  }

  private aggregateProfile(
    user: SafeUser,
    roleHistory: UserRoleHistory[],
    batchMemberships: BatchMember[],
    mentorMappings: MentorMentee[],
    courseAllocations: CourseAllocation[],
    submissions: Submission[],
    query: User360QueryParams,
  ): User360Profile {
    const roleItems: RoleHistoryItem[] = roleHistory.map((rh) => ({
      id: rh.id,
      role: rh.role,
      fromAt: rh.fromAt,
      toAt: rh.toAt,
      reason: rh.reason,
      changedBy: rh.changedBy,
      periodLabel: this.formatPeriodLabel(rh.role, rh.fromAt, rh.toAt),
    }));

    // Filter role history if requested
    const filteredRoleHistory = roleItems.filter((rh) => {
      if (query.rolePeriod && rh.role !== query.rolePeriod) return false;
      if (query.startDate && rh.fromAt < new Date(query.startDate)) return false;
      if (query.endDate && rh.fromAt > new Date(query.endDate)) return false;
      return true;
    });

    // Batch History
    const batchItems: BatchHistoryItem[] = batchMemberships
      .map((bm) => {
        const period = this.getRolePeriodForDate(bm.joinedAt, roleHistory, user.role);
        return {
          id: bm.id,
          batchId: bm.batchId,
          batchName: bm.batch?.name ?? 'Unknown Batch',
          batchCode: bm.batch?.code ?? 'N/A',
          role: bm.memberRole,
          joinedAt: bm.joinedAt,
          leftAt: bm.leftAt,
          reasonToLeave: bm.reasonToLeave,
          isActive: bm.isActive,
          periodLabel: period.label,
        };
      })
      .filter((b) => {
        if (query.batchId && b.batchId !== query.batchId) return false;
        if (query.rolePeriod && String(b.role) !== String(query.rolePeriod)) return false;
        if (query.startDate && b.joinedAt < new Date(query.startDate)) return false;
        if (query.endDate && b.joinedAt > new Date(query.endDate)) return false;
        return true;
      });

    // Mentor Mapping History
    const mappingItems: MentorMappingItem[] = mentorMappings
      .map((mm) => {
        const isUserMentor = mm.mentorId === user.id;
        const peer = isUserMentor ? mm.mentee : mm.mentor;
        const period = this.getRolePeriodForDate(mm.startDate, roleHistory, user.role);
        return {
          id: mm.id,
          batchId: mm.batchId,
          batchCode: mm.batch?.code ?? 'N/A',
          mappedRole: isUserMentor ? ('MENTOR' as const) : ('MENTEE' as const),
          peerId: peer?.id ?? (isUserMentor ? mm.menteeId : mm.mentorId),
          peerName: peer?.name ?? 'Unknown User',
          peerEmail: peer?.email ?? '',
          startDate: mm.startDate,
          endDate: mm.endDate,
          isActive: mm.isActive,
          endReason: mm.endReason,
          periodLabel: period.label,
        };
      })
      .filter((m) => {
        if (query.batchId && m.batchId !== query.batchId) return false;
        if (query.rolePeriod && String(m.mappedRole) !== String(query.rolePeriod)) return false;
        if (query.startDate && m.startDate < new Date(query.startDate)) return false;
        if (query.endDate && m.startDate > new Date(query.endDate)) return false;
        return true;
      });

    // Course History
    const courseItems: CourseHistoryItem[] = courseAllocations
      .map((ca) => {
        const period = this.getRolePeriodForDate(ca.startDate, roleHistory, user.role);
        return {
          id: ca.id,
          courseId: ca.courseId,
          courseTitle: ca.course?.title ?? 'Untitled Course',
          batchId: ca.batchId,
          batchCode: ca.batch?.code ?? null,
          status: ca.status,
          startDate: ca.startDate,
          dueDate: ca.dueDate,
          completedAt: ca.completedAt,
          progressPercent: ca.progressPercent,
          periodLabel: period.label,
        };
      })
      .filter((c) => {
        if (query.batchId && c.batchId !== query.batchId) return false;
        if (query.rolePeriod && query.rolePeriod !== UserRole.MENTEE) return false;
        if (query.startDate && c.startDate < new Date(query.startDate)) return false;
        if (query.endDate && c.startDate > new Date(query.endDate)) return false;
        return true;
      });

    // Submission & Grade History
    const submissionItems: SubmissionHistoryItem[] = submissions
      .map((sub) => {
        const period = this.getRolePeriodForDate(sub.submittedAt, roleHistory, user.role);
        return {
          id: sub.id,
          assignmentId: sub.assignmentId,
          assignmentTitle: sub.assignment?.title ?? 'Untitled Assignment',
          courseAllocationId: sub.courseAllocationId,
          batchId: sub.batchId,
          version: sub.version,
          status: sub.status,
          submittedAt: sub.submittedAt,
          isLate: sub.isLate,
          marks: sub.marks,
          gradeLabel: sub.gradeLabel,
          feedback: sub.feedback,
          gradedAt: sub.gradedAt,
          graderName: sub.grader?.name ?? null,
          periodLabel: period.label,
        };
      })
      .filter((s) => {
        if (query.batchId && s.batchId !== query.batchId) return false;
        if (query.rolePeriod && query.rolePeriod !== UserRole.MENTEE) return false;
        if (query.startDate && s.submittedAt < new Date(query.startDate)) return false;
        if (query.endDate && s.submittedAt > new Date(query.endDate)) return false;
        return true;
      });

    // Performance Summary
    const totalAllocations = courseItems.length;
    const completedAllocations = courseItems.filter((c) => c.status === 'COMPLETED').length;
    const inProgressAllocations = courseItems.filter((c) => c.status === 'IN_PROGRESS').length;
    const averageProgressPercent =
      totalAllocations > 0
        ? courseItems.reduce((acc, c) => acc + c.progressPercent, 0) / totalAllocations
        : 0;

    const totalSubmissions = submissionItems.length;
    const gradedSubmissions = submissionItems.filter((s) => s.marks !== null).length;
    const marksSum = submissionItems.reduce((acc, s) => acc + (s.marks ?? 0), 0);
    const averageMarks = gradedSubmissions > 0 ? marksSum / gradedSubmissions : null;

    const onTimeSubmissions = submissionItems.filter((s) => !s.isLate).length;
    const lateSubmissions = submissionItems.filter((s) => s.isLate).length;
    const onTimeRatePercent =
      totalSubmissions > 0 ? (onTimeSubmissions / totalSubmissions) * 100 : 100;

    const gradeDistribution: Record<string, number> = {};
    for (const sub of submissionItems) {
      if (sub.gradeLabel) {
        gradeDistribution[sub.gradeLabel] = (gradeDistribution[sub.gradeLabel] ?? 0) + 1;
      }
    }

    const performanceSummary: PerformanceSummary = {
      totalAllocations,
      completedAllocations,
      inProgressAllocations,
      averageProgressPercent,
      totalSubmissions,
      gradedSubmissions,
      averageMarks,
      onTimeSubmissions,
      lateSubmissions,
      onTimeRatePercent,
      gradeDistribution,
    };

    // Synthetic Audit Tab
    const auditItems: AuditHistoryItem[] = [];

    // Role changes
    for (const rh of roleHistory) {
      auditItems.push({
        id: `audit-role-${rh.id}`,
        type: 'USER_ROLE',
        action: 'ROLE_CHANGED',
        timestamp: rh.fromAt,
        actorId: rh.changedBy,
        details: { role: rh.role, reason: rh.reason },
        periodLabel: this.formatPeriodLabel(rh.role, rh.fromAt, rh.toAt),
      });
    }

    // Batch memberships
    for (const bm of batchMemberships) {
      auditItems.push({
        id: `audit-bm-join-${bm.id}`,
        type: 'BATCH',
        action: 'BATCH_JOINED',
        timestamp: bm.joinedAt,
        actorId: bm.createdBy,
        details: { batchId: bm.batchId, role: bm.memberRole },
        periodLabel: this.getRolePeriodForDate(bm.joinedAt, roleHistory, user.role).label,
      });
      if (bm.leftAt) {
        auditItems.push({
          id: `audit-bm-leave-${bm.id}`,
          type: 'BATCH',
          action: 'BATCH_LEFT',
          timestamp: bm.leftAt,
          actorId: bm.updatedBy,
          details: { batchId: bm.batchId, reasonToLeave: bm.reasonToLeave },
          periodLabel: this.getRolePeriodForDate(bm.leftAt, roleHistory, user.role).label,
        });
      }
    }

    // Submissions and Grading
    for (const sub of submissions) {
      if (sub.status === SubmissionStatus.GRADED && sub.gradedAt) {
        auditItems.push({
          id: `audit-grade-${sub.id}`,
          type: 'GRADING',
          action: 'ASSIGNMENT_GRADED',
          timestamp: sub.gradedAt,
          actorId: sub.gradedBy,
          details: {
            assignmentId: sub.assignmentId,
            marks: sub.marks,
            gradeLabel: sub.gradeLabel,
            feedback: sub.feedback,
          },
          periodLabel: this.getRolePeriodForDate(sub.gradedAt, roleHistory, user.role).label,
        });
      }
    }

    // Sort audit chronologically descending
    auditItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const filteredAudit = auditItems.filter((a) => {
      if (query.auditType && a.type !== query.auditType) return false;
      if (query.startDate && a.timestamp < new Date(query.startDate)) return false;
      if (query.endDate && a.timestamp > new Date(query.endDate)) return false;
      return true;
    });

    return {
      user,
      tabs: {
        profile: user,
        roleHistory: filteredRoleHistory,
        batchHistory: batchItems,
        mentorMappingHistory: mappingItems,
        courseHistory: courseItems,
        assignmentGradeHistory: submissionItems,
        performanceSummary,
        audit: filteredAudit,
      },
    };
  }

  private filterByTab(profile: User360Profile, tab: User360Tab): Partial<User360Profile> {
    switch (tab) {
      case 'profile':
        return { user: profile.user, tabs: { profile: profile.user } as User360Profile['tabs'] };
      case 'role-history':
        return {
          user: profile.user,
          tabs: { roleHistory: profile.tabs.roleHistory } as User360Profile['tabs'],
        };
      case 'batch-history':
        return {
          user: profile.user,
          tabs: { batchHistory: profile.tabs.batchHistory } as User360Profile['tabs'],
        };
      case 'mentor-mapping-history':
        return {
          user: profile.user,
          tabs: {
            mentorMappingHistory: profile.tabs.mentorMappingHistory,
          } as User360Profile['tabs'],
        };
      case 'course-history':
        return {
          user: profile.user,
          tabs: { courseHistory: profile.tabs.courseHistory } as User360Profile['tabs'],
        };
      case 'assignment-grade-history':
        return {
          user: profile.user,
          tabs: {
            assignmentGradeHistory: profile.tabs.assignmentGradeHistory,
          } as User360Profile['tabs'],
        };
      case 'performance-summary':
        return {
          user: profile.user,
          tabs: {
            performanceSummary: profile.tabs.performanceSummary,
          } as User360Profile['tabs'],
        };
      case 'audit':
        return {
          user: profile.user,
          tabs: { audit: profile.tabs.audit } as User360Profile['tabs'],
        };
      default:
        return profile;
    }
  }

  private getRolePeriodForDate(
    date: Date,
    history: UserRoleHistory[],
    fallbackRole: UserRole,
  ): { role: UserRole; label: string } {
    for (const h of history) {
      const from = new Date(h.fromAt);
      const to = h.toAt ? new Date(h.toAt) : null;
      if (date >= from && (!to || date <= to)) {
        return {
          role: h.role,
          label: this.formatPeriodLabel(h.role, from, to),
        };
      }
    }
    return {
      role: fallbackRole,
      label: `As ${this.formatRoleName(fallbackRole)}`,
    };
  }

  private formatPeriodLabel(role: UserRole, from: Date, to: Date | null): string {
    const roleName = this.formatRoleName(role);
    const fromStr = this.formatMonthYear(from);
    const toStr = to ? this.formatMonthYear(to) : 'Present';
    return `As ${roleName}: ${fromStr}–${toStr}`;
  }

  private formatRoleName(role: UserRole): string {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return 'Super Admin';
      case UserRole.MENTOR:
        return 'Mentor';
      case UserRole.MENTEE:
      default:
        return 'Mentee';
    }
  }

  private formatMonthYear(date: Date): string {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

export const user360Service = new User360Service();
