import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { MentorMentee } from '../../src/modules/batches';
import {
  type AdminDashboardResponse,
  DashboardRepository,
  DashboardService,
  DEFAULT_LATEST_SUBMISSIONS_LIMIT,
  DEFAULT_RECENT_SUBMISSIONS_LIMIT,
  DEFAULT_UPCOMING_DEADLINES_LIMIT,
} from '../../src/modules/dashboard';

void describe('DashboardService Unit Tests (Module 12: FR-12.1 - FR-12.5)', () => {
  let service: DashboardService;
  let mockRepository: Partial<DashboardRepository>;

  const mentorId = '11111111-1111-4111-a111-111111111111';
  const menteeId = '22222222-2222-4222-a222-222222222222';
  const batchId1 = '33333333-3333-4333-a333-333333333333';
  const batchId2 = '44444444-4444-4444-a444-444444444444';

  beforeEach(() => {
    mockRepository = {};
    service = new DashboardService(mockRepository as DashboardRepository);
  });

  void describe('Admin Dashboard (FR-12.1)', () => {
    void it('should return complete admin metrics and parse valid response schema', async () => {
      const mockMetrics: AdminDashboardResponse = {
        users: {
          totalUsers: 30,
          menteesCount: 20,
          mentorsCount: 8,
          adminsCount: 2,
        },
        batches: {
          totalBatches: 15,
          liveBatches: 5,
          draftBatches: 3,
          completedBatches: 4,
          onHoldBatches: 2,
          archivedBatches: 1,
        },
        courses: {
          totalCourses: 10,
          publishedCourses: 8,
        },
        allocations: {
          activeAllocations: 25,
          completedAllocations: 15,
        },
        submissions: {
          pendingReviewCount: 7,
          gradedCount: 42,
          resubmitRequestedCount: 3,
        },
      };

      mockRepository.getAdminMetrics = () => Promise.resolve(mockMetrics);

      const result = await service.getAdminDashboard();

      assert.deepStrictEqual(result, mockMetrics);
      assert.strictEqual(
        result.batches.totalBatches,
        result.batches.liveBatches +
          result.batches.draftBatches +
          result.batches.completedBatches +
          result.batches.onHoldBatches +
          result.batches.archivedBatches,
      );
    });
  });

  void describe('Mentor Dashboard (FR-12.2 - FR-12.3)', () => {
    void it('should set isZeroState to true when mentor has 0 batches and 0 mentees (DSH-08)', async () => {
      mockRepository.getMentorAssignedBatchesCount = () => Promise.resolve(0);
      mockRepository.getMentorActiveMappings = () => Promise.resolve([]);
      mockRepository.getMentorSubmissionsStats = () =>
        Promise.resolve({
          pendingReviewCount: 0,
          gradedCount: 0,
        });
      mockRepository.getMentorLatestSubmissions = () => Promise.resolve([]);

      const result = await service.getMentorDashboard(mentorId);

      assert.strictEqual(result.isZeroState, true);
      assert.strictEqual(result.assignedBatchesCount, 0);
      assert.strictEqual(result.activeMenteesCount, 0);
      assert.strictEqual(result.latestSubmissions.length, 0);
    });

    void it('should set isZeroState to false when mentor has assigned batches or mentees', async () => {
      const startDate = new Date('2026-08-01T00:00:00Z');
      const mockMappings = [
        {
          id: 'mm-1',
          mentorId,
          menteeId,
          batchId: batchId1,
          startDate,
          isActive: true,
        } as unknown as MentorMentee,
      ];

      mockRepository.getMentorAssignedBatchesCount = () => Promise.resolve(1);
      mockRepository.getMentorActiveMappings = () => Promise.resolve(mockMappings);
      mockRepository.getMentorSubmissionsStats = (pairs) => {
        assert.strictEqual(pairs.length, 1);
        assert.strictEqual(pairs[0]?.startDate, startDate);
        return Promise.resolve({ pendingReviewCount: 2, gradedCount: 10 });
      };
      mockRepository.getMentorLatestSubmissions = (pairs, limit) => {
        assert.strictEqual(pairs.length, 1);
        assert.strictEqual(limit, DEFAULT_LATEST_SUBMISSIONS_LIMIT);
        return Promise.resolve([]);
      };

      const result = await service.getMentorDashboard(mentorId);

      assert.strictEqual(result.isZeroState, false);
      assert.strictEqual(result.assignedBatchesCount, 1);
      assert.strictEqual(result.activeMenteesCount, 1);
      assert.strictEqual(result.pendingReviewCount, 2);
      assert.strictEqual(result.gradedCount, 10);
    });

    void it('should deduplicate active mentees across overlapping batches', async () => {
      const now = new Date();
      const mockMappings = [
        {
          id: 'mm-1',
          mentorId,
          menteeId,
          batchId: batchId1,
          startDate: now,
          isActive: true,
        } as unknown as MentorMentee,
        {
          id: 'mm-2',
          mentorId,
          menteeId, // Same mentee in different batch
          batchId: batchId2,
          startDate: now,
          isActive: true,
        } as unknown as MentorMentee,
      ];

      mockRepository.getMentorAssignedBatchesCount = () => Promise.resolve(2);
      mockRepository.getMentorActiveMappings = () => Promise.resolve(mockMappings);
      mockRepository.getMentorSubmissionsStats = (pairs) => {
        assert.strictEqual(pairs.length, 2);
        return Promise.resolve({ pendingReviewCount: 1, gradedCount: 5 });
      };
      mockRepository.getMentorLatestSubmissions = () => Promise.resolve([]);

      const result = await service.getMentorDashboard(mentorId);

      assert.strictEqual(result.activeMenteesCount, 1); // Deduplicated 2 mappings -> 1 unique mentee
      assert.strictEqual(result.assignedBatchesCount, 2);
      assert.strictEqual(result.isZeroState, false);
    });
  });

  void describe('Mentee Dashboard (FR-12.4 - FR-12.5)', () => {
    void it('should calculate overallProgressPercent and correctly derive isOverdue for deadlines', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 3).toISOString();
      const pastDate = new Date(Date.now() - 86400000 * 2).toISOString();

      mockRepository.getMenteeAllocationsSummary = () =>
        Promise.resolve({
          activeCoursesCount: 2,
          completedCoursesCount: 1,
          overallProgressPercent: 67.5,
        });
      mockRepository.getMenteePendingAssignmentsCount = () => Promise.resolve(3);
      mockRepository.getMenteeRecentSubmissions = (_id, limit) => {
        assert.strictEqual(limit, DEFAULT_RECENT_SUBMISSIONS_LIMIT);
        return Promise.resolve([
          {
            id: '77777777-7777-4777-a777-777777777777',
            assignmentId: '33333333-3333-4333-a333-333333333333',
            assignmentTitle: 'Assignment 1',
            courseName: 'TypeScript Basics',
            status: 'SUBMITTED',
            marks: null,
            gradeLabel: null,
            isLate: false,
            submittedAt: new Date().toISOString(),
          },
        ]);
      };
      mockRepository.getMenteeUpcomingDeadlines = (_id, limit) => {
        assert.strictEqual(limit, DEFAULT_UPCOMING_DEADLINES_LIMIT);
        return Promise.resolve([
          {
            allocationId: '55555555-5555-5555-a555-555555555555',
            courseName: 'Advanced Node.js',
            dueDate: futureDate,
            progressPercent: 40,
          },
          {
            allocationId: '66666666-6666-6666-a666-666666666666',
            courseName: 'Database Design',
            dueDate: pastDate,
            progressPercent: 10,
          },
        ]);
      };

      const result = await service.getMenteeDashboard(menteeId);

      assert.strictEqual(result.activeCoursesCount, 2);
      assert.strictEqual(result.completedCoursesCount, 1);
      assert.strictEqual(result.overallProgressPercent, 67.5);
      assert.strictEqual(result.pendingAssignmentsCount, 3);
      assert.strictEqual(result.recentSubmissions.length, 1);
      assert.strictEqual(result.upcomingDeadlines.length, 2);

      // Verify isOverdue was derived in service layer
      assert.strictEqual(result.upcomingDeadlines[0]?.isOverdue, false);
      assert.strictEqual(result.upcomingDeadlines[1]?.isOverdue, true);
    });

    void it('should handle zero active allocations gracefully', async () => {
      mockRepository.getMenteeAllocationsSummary = () =>
        Promise.resolve({
          activeCoursesCount: 0,
          completedCoursesCount: 0,
          overallProgressPercent: 0,
        });
      mockRepository.getMenteePendingAssignmentsCount = () => Promise.resolve(0);
      mockRepository.getMenteeRecentSubmissions = () => Promise.resolve([]);
      mockRepository.getMenteeUpcomingDeadlines = () => Promise.resolve([]);

      const result = await service.getMenteeDashboard(menteeId);

      assert.strictEqual(result.activeCoursesCount, 0);
      assert.strictEqual(result.completedCoursesCount, 0);
      assert.strictEqual(result.overallProgressPercent, 0);
      assert.strictEqual(result.pendingAssignmentsCount, 0);
      assert.strictEqual(result.recentSubmissions.length, 0);
      assert.strictEqual(result.upcomingDeadlines.length, 0);
    });
  });
});
