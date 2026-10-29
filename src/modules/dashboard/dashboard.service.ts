import { DashboardRepository, dashboardRepository } from './dashboard.repository';
import type {
  AdminDashboardResponse,
  MenteeDashboardResponse,
  MentorDashboardResponse,
} from './schemas/dashboard.schemas';

export class DashboardService {
  constructor(private readonly repository: DashboardRepository = dashboardRepository) {}

  public async getAdminDashboard(): Promise<AdminDashboardResponse> {
    return this.repository.getAdminMetrics();
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
    }));

    const [stats, latestSubmissions] = await Promise.all([
      this.repository.getMentorSubmissionsStats(allowedPairs),
      this.repository.getMentorLatestSubmissions(allowedPairs, 10),
    ]);

    const hasGuidance = assignedBatchesCount === 0 && activeMenteesCount === 0;

    return {
      assignedBatchesCount,
      activeMenteesCount,
      pendingReviewCount: stats.pendingReviewCount,
      gradedCount: stats.gradedCount,
      hasGuidance,
      latestSubmissions,
    };
  }

  public async getMenteeDashboard(menteeId: string): Promise<MenteeDashboardResponse> {
    const [allocSummary, pendingAssignmentsCount, recentSubmissions, upcomingDeadlines] =
      await Promise.all([
        this.repository.getMenteeAllocationsSummary(menteeId),
        this.repository.getMenteePendingAssignmentsCount(menteeId),
        this.repository.getMenteeRecentSubmissions(menteeId, 5),
        this.repository.getMenteeUpcomingDeadlines(menteeId, 5),
      ]);

    return {
      activeCoursesCount: allocSummary.activeCoursesCount,
      completedCoursesCount: allocSummary.completedCoursesCount,
      overallProgressPercent: allocSummary.overallProgressPercent,
      pendingAssignmentsCount,
      recentSubmissions,
      upcomingDeadlines,
    };
  }
}

export const dashboardService = new DashboardService();
