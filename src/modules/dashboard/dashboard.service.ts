import { DashboardRepository, dashboardRepository } from './dashboard.repository';
import {
  type AdminDashboardResponse,
  adminDashboardSchema,
  type MenteeDashboardResponse,
  menteeDashboardSchema,
  type MentorDashboardResponse,
  mentorDashboardSchema,
} from './schemas/dashboard.schemas';

export const DEFAULT_LATEST_SUBMISSIONS_LIMIT = 10;
export const DEFAULT_RECENT_SUBMISSIONS_LIMIT = 5;
export const DEFAULT_UPCOMING_DEADLINES_LIMIT = 5;

export class DashboardService {
  constructor(private readonly repository: DashboardRepository = dashboardRepository) {}

  public async getAdminDashboard(): Promise<AdminDashboardResponse> {
    const metrics = await this.repository.getAdminMetrics();
    return adminDashboardSchema.parse(metrics);
  }

  public async getMentorDashboard(mentorId: string): Promise<MentorDashboardResponse> {
    const [assignedBatchesCount, mappings] = await Promise.all([
      this.repository.getMentorAssignedBatchesCount(mentorId),
      this.repository.getMentorActiveMappings(mentorId),
    ]);

    const activeMenteesCount = new Set(mappings.map((m) => m.menteeId)).size;
    const allowedPairs = mappings.map((m) => ({
      batchId: m.batchId,
      menteeId: m.menteeId,
      startDate: m.startDate,
    }));

    const [stats, latestSubmissions] = await Promise.all([
      this.repository.getMentorSubmissionsStats(allowedPairs),
      this.repository.getMentorLatestSubmissions(allowedPairs, DEFAULT_LATEST_SUBMISSIONS_LIMIT),
    ]);

    const isZeroState = assignedBatchesCount === 0 && activeMenteesCount === 0;

    const response = {
      assignedBatchesCount,
      activeMenteesCount,
      pendingReviewCount: stats.pendingReviewCount,
      gradedCount: stats.gradedCount,
      isZeroState,
      latestSubmissions,
    };

    return mentorDashboardSchema.parse(response);
  }

  public async getMenteeDashboard(menteeId: string): Promise<MenteeDashboardResponse> {
    const [allocSummary, pendingAssignmentsCount, recentSubmissions, upcomingDeadlines] =
      await Promise.all([
        this.repository.getMenteeAllocationsSummary(menteeId),
        this.repository.getMenteePendingAssignmentsCount(menteeId),
        this.repository.getMenteeRecentSubmissions(menteeId, DEFAULT_RECENT_SUBMISSIONS_LIMIT),
        this.repository.getMenteeUpcomingDeadlines(menteeId, DEFAULT_UPCOMING_DEADLINES_LIMIT),
      ]);

    const now = new Date();
    const response = {
      activeCoursesCount: allocSummary.activeCoursesCount,
      completedCoursesCount: allocSummary.completedCoursesCount,
      overallProgressPercent: allocSummary.overallProgressPercent,
      pendingAssignmentsCount,
      recentSubmissions,
      upcomingDeadlines: upcomingDeadlines.map((d) => ({
        ...d,
        isOverdue: new Date(d.dueDate) < now,
      })),
    };

    return menteeDashboardSchema.parse(response);
  }
}

export const dashboardService = new DashboardService();
