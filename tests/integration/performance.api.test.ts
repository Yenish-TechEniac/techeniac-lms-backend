import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import { app } from '../../src/app';
import { signAccessToken } from '../../src/core/auth';
import { exportService, performanceRepository } from '../../src/modules/performance';
import { type User, userRepository, UserRole } from '../../src/modules/users';

void describe('Performance API & Aggregation Integration Tests (Module 11)', () => {
  let server: Server;
  let baseUrl: string;

  const adminId = '11111111-2222-4333-8444-555555555555';
  const menteeId = '33333333-4444-4555-8666-777777777777';

  let tokenAdmin: string;
  let tokenMentee: string;
  const origFindById = userRepository.findById.bind(userRepository);

  before(async () => {
    userRepository.findById = (id: string): Promise<User | null> => {
      if (id === adminId) {
        return Promise.resolve({
          id: adminId,
          email: 'admin@techeniac.com',
          name: 'Super Admin',
          role: UserRole.SUPER_ADMIN,
          isActive: true,
          tokenVersion: 1,
        } as User);
      }
      if (id === menteeId) {
        return Promise.resolve({
          id: menteeId,
          email: 'mentee@techeniac.com',
          name: 'Mentee User',
          role: UserRole.MENTEE,
          isActive: true,
          tokenVersion: 1,
        } as User);
      }
      return Promise.resolve(null);
    };

    tokenAdmin = signAccessToken({
      sub: adminId,
      email: 'admin@techeniac.com',
      role: 'SUPER_ADMIN',
      tokenVersion: 1,
    });

    tokenMentee = signAccessToken({
      sub: menteeId,
      email: 'mentee@techeniac.com',
      role: 'MENTEE',
      tokenVersion: 1,
    });

    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 4000;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
  });

  after(() => {
    userRepository.findById = origFindById;
    server.close();
  });

  void it('returns 200 with standard pagination envelope for /performance', async () => {
    const origOverview = performanceRepository.getPerformanceOverview.bind(performanceRepository);
    const origList = performanceRepository.getMenteePerformanceList.bind(performanceRepository);

    performanceRepository.getPerformanceOverview = () =>
      Promise.resolve({
        averageMarks: 85.5,
        gradeDistribution: {
          'A+': { count: 1, percentage: 100 },
          A: { count: 0, percentage: 0 },
          B: { count: 0, percentage: 0 },
          C: { count: 0, percentage: 0 },
          D: { count: 0, percentage: 0 },
          F: { count: 0, percentage: 0 },
        },
        onTimeRate: 100,
        completionPercentage: 100,
        overdueCount: 0,
        totalMentees: 1,
        totalSubmissions: 1,
      });

    performanceRepository.getMenteePerformanceList = () =>
      Promise.resolve({
        mentees: [
          {
            menteeId,
            menteeName: 'Alice Mentee',
            menteeEmail: 'alice@test.com',
            batchId: 'batch-1',
            batchName: 'Batch Alpha',
            assignedCoursesCount: 1,
            completedCoursesCount: 1,
            completionPercentage: 100,
            averageMarks: 85.5,
            totalSubmissions: 1,
            onTimeSubmissions: 1,
            onTimeRate: 100,
            overdueCount: 0,
            latestGrade: 'A+',
          },
        ],
        total: 1,
      });

    try {
      const res = await fetch(`${baseUrl}/performance?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` },
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as {
        success: boolean;
        data: {
          metrics: { averageMarks: number };
          mentees: Array<{ menteeId: string }>;
        };
        meta: { page: number; limit: number; total: number; totalPages: number };
      };

      assert.equal(json.success, true);
      assert.equal(json.data.metrics.averageMarks, 85.5);
      assert.equal(json.data.mentees.length, 1);
      assert.equal(json.meta.page, 1);
      assert.equal(json.meta.total, 1);
      assert.equal(json.meta.totalPages, 1);
    } finally {
      performanceRepository.getPerformanceOverview = origOverview;
      performanceRepository.getMenteePerformanceList = origList;
    }
  });

  void it('returns CSV export with sanitized formula prefixes for = @ + -', () => {
    const csv = exportService.generatePerformanceCsv([
      {
        menteeId,
        menteeName: '=HYPERLINK("http://malicious.site")',
        menteeEmail: '+1234567890@test.com',
        batchId: null,
        batchName: null,
        assignedCoursesCount: 1,
        completedCoursesCount: 0,
        completionPercentage: 0,
        averageMarks: null,
        totalSubmissions: 0,
        onTimeSubmissions: 0,
        onTimeRate: 0,
        overdueCount: 0,
        latestGrade: null,
      },
    ]);

    assert.match(csv, /"'=HYPERLINK/);
    assert.match(csv, /"'\+1234567890/);
  });

  void it('blocks MENTEE from accessing /performance with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/performance`, {
      headers: { Authorization: `Bearer ${tokenMentee}` },
    });
    assert.equal(res.status, 403);
  });
});
