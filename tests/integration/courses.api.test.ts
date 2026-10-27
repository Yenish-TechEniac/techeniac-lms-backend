import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';

import { app } from '../../src/app';
import { signAccessToken } from '../../src/core/auth';
import {
  type Course,
  coursesRepository,
  type Subtopic,
  type Topic,
} from '../../src/modules/courses';
import { type User, userRepository } from '../../src/modules/users';

void describe('Courses API Integration Tests', () => {
  let server: Server;
  let baseUrl: string;

  const mentorAId = '11111111-1111-4111-a111-111111111111';
  const mentorBId = '22222222-2222-4222-a222-222222222222';
  const adminId = '33333333-3333-4333-a333-333333333333';
  const courseId = '44444444-4444-4444-a444-444444444444';
  const topicId = '55555555-5555-4555-a555-555555555555';

  let tokenMentorA: string;
  let tokenMentorB: string;
  let tokenAdmin: string;

  before(async () => {
    tokenMentorA = signAccessToken({
      sub: mentorAId,
      email: 'mentorA@techeniac.com',
      role: 'MENTOR',
      tokenVersion: 1,
    });

    tokenMentorB = signAccessToken({
      sub: mentorBId,
      email: 'mentorB@techeniac.com',
      role: 'MENTOR',
      tokenVersion: 1,
    });

    tokenAdmin = signAccessToken({
      sub: adminId,
      email: 'admin@techeniac.com',
      role: 'SUPER_ADMIN',
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
    server.close();
  });

  beforeEach(() => {
    // Stub user repository to resolve users from tokens
    userRepository.findById = (id: string): Promise<User | null> => {
      if (id === mentorAId) {
        return Promise.resolve({
          id: mentorAId,
          email: 'mentorA@techeniac.com',
          role: 'MENTOR',
          isActive: true,
          tokenVersion: 1,
        } as User);
      }
      if (id === mentorBId) {
        return Promise.resolve({
          id: mentorBId,
          email: 'mentorB@techeniac.com',
          role: 'MENTOR',
          isActive: true,
          tokenVersion: 1,
        } as User);
      }
      if (id === adminId) {
        return Promise.resolve({
          id: adminId,
          email: 'admin@techeniac.com',
          role: 'SUPER_ADMIN',
          isActive: true,
          tokenVersion: 1,
        } as User);
      }
      return Promise.resolve(null);
    };
  });

  void describe('Authorization across Mentors (Mentor A vs Mentor B) (CRS-18)', () => {
    void it('returns 403 Forbidden when Mentor B tries to update Mentor A course', async () => {
      const mockCourse = {
        id: courseId,
        title: "Mentor A's Course",
        createdBy: mentorAId,
        updatedAt: new Date(),
      } as Course;

      coursesRepository.findCourseById = () => Promise.resolve(mockCourse);

      const res = await fetch(`${baseUrl}/courses/${courseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMentorB}`,
        },
        body: JSON.stringify({
          title: 'Hacked by Mentor B',
          expectedUpdatedAt: mockCourse.updatedAt.toISOString(),
        }),
      });

      assert.equal(res.status, 403);
      const data = (await res.json()) as { error?: { code: string; message: string } };
      assert.equal(data.error?.code, 'FORBIDDEN');
    });

    void it('returns 403 Forbidden when Mentor B tries to delete Mentor A course', async () => {
      const mockCourse = {
        id: courseId,
        title: "Mentor A's Course",
        createdBy: mentorAId,
      } as Course;

      coursesRepository.findCourseById = () => Promise.resolve(mockCourse);

      const res = await fetch(`${baseUrl}/courses/${courseId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokenMentorB}`,
        },
      });

      assert.equal(res.status, 403);
      const data = (await res.json()) as { error?: { code: string } };
      assert.equal(data.error?.code, 'FORBIDDEN');
    });

    void it('allows SUPER_ADMIN to update Mentor A course', async () => {
      const mockCourse = {
        id: courseId,
        title: "Mentor A's Course",
        createdBy: mentorAId,
        updatedAt: new Date(),
      } as Course;

      coursesRepository.findCourseById = () => Promise.resolve(mockCourse);
      coursesRepository.updateCourse = (_id, payload) =>
        Promise.resolve({ ...mockCourse, ...payload });

      const res = await fetch(`${baseUrl}/courses/${courseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`,
        },
        body: JSON.stringify({
          title: 'Admin Updated Title',
          expectedUpdatedAt: mockCourse.updatedAt.toISOString(),
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        success: boolean;
        data?: { title: string };
      };
      assert.equal(data.success, true);
      assert.equal(data.data?.title, 'Admin Updated Title');
    });
  });

  void describe('List Courses Defaults & Pagination (FR-6.6, M6-LIST-1, M6-SEARCH-1)', () => {
    void it('applies default pagination limit=20, page=1 when called with no query params', async () => {
      const mockCourses: Course[] = [
        {
          id: courseId,
          title: 'Course 1',
          isActive: true,
          topicCount: 2,
          assignmentCount: 1,
          createdAt: new Date(),
        } as Course,
      ];

      coursesRepository.listCourses = (opts) => {
        assert.equal(opts?.page, 1);
        assert.equal(opts?.limit, 20);
        assert.equal(opts?.sortBy, 'createdAt');
        assert.equal(opts?.sortOrder, 'desc');
        return Promise.resolve({ items: mockCourses, total: 1 });
      };

      const res = await fetch(`${baseUrl}/courses`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
        },
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        success: boolean;
        data?: Course[];
        meta?: { page: number; limit: number; total: number; totalPages: number };
      };

      assert.equal(data.success, true);
      assert.equal(data.meta?.page, 1);
      assert.equal(data.meta?.limit, 20);
      assert.equal(data.meta?.total, 1);
      assert.equal(Array.isArray(data.data), true);
      assert.equal(data.data?.length, 1);
    });

    void it('properly handles search query with wildcard escaping', async () => {
      coursesRepository.listCourses = (opts) => {
        assert.equal(opts?.search, '100%');
        return Promise.resolve({ items: [], total: 0 });
      };

      const res = await fetch(`${baseUrl}/courses?search=100%25`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
        },
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as { success: boolean; meta?: { total: number } };
      assert.equal(data.success, true);
      assert.equal(data.meta?.total, 0);
    });

    void it('properly handles isActive=true, isActive=false, and isActive=all query filters', async () => {
      const capturedOpts: Array<unknown> = [];
      coursesRepository.listCourses = (opts) => {
        capturedOpts.push(opts?.isActive);
        return Promise.resolve({ items: [], total: 0 });
      };

      const resTrue = await fetch(
        `${baseUrl}/courses?page=1&limit=50&isActive=true&sortBy=createdAt&sortOrder=desc`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tokenAdmin}`,
          },
        },
      );
      assert.equal(resTrue.status, 200);

      const resFalse = await fetch(
        `${baseUrl}/courses?page=1&limit=50&isActive=false&sortBy=createdAt&sortOrder=desc`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tokenAdmin}`,
          },
        },
      );
      assert.equal(resFalse.status, 200);

      const resAll = await fetch(
        `${baseUrl}/courses?page=1&limit=50&isActive=all&sortBy=createdAt&sortOrder=desc`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tokenAdmin}`,
          },
        },
      );
      assert.equal(resAll.status, 200);

      assert.deepEqual(capturedOpts, [true, false, undefined]);
    });
  });

  void describe('Creator PII Stripping (M6-PII-1)', () => {
    void it('serializes only safe creator fields (id, name) and omits email, tokenVersion', async () => {
      const mockCourseWithPii = {
        id: courseId,
        title: 'Security Audited Course',
        createdBy: mentorAId,
        creator: {
          id: mentorAId,
          name: 'Mentor Alice',
          email: 'alice@techeniac.com',
          tokenVersion: 5,
          mustChangePassword: true,
          lastLoginAt: new Date(),
        } as unknown as User,
      } as Course;

      coursesRepository.findCourseById = () => Promise.resolve(mockCourseWithPii);

      const res = await fetch(`${baseUrl}/courses/${courseId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenMentorB}`,
        },
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        success: boolean;
        data?: {
          creator?: {
            id: string;
            name: string;
            email?: string;
            tokenVersion?: number;
          };
        };
      };

      assert.equal(data.success, true);
      assert.equal(data.data?.creator?.id, mentorAId);
      assert.equal(data.data?.creator?.name, 'Mentor Alice');
      assert.equal(data.data?.creator?.email, undefined, 'email must not be exposed');
      assert.equal(data.data?.creator?.tokenVersion, undefined, 'tokenVersion must not be exposed');
    });
  });

  void describe('Reordering Ownership and IDOR Prevention (CRS-17)', () => {
    void it('returns 400 Validation Error when reordering topics with a foreign topic ID', async () => {
      const mockCourse = {
        id: courseId,
        createdBy: mentorAId,
        topics: [{ id: topicId }] as Topic[],
      } as Course;

      coursesRepository.findCourseById = () => Promise.resolve(mockCourse);

      const res = await fetch(`${baseUrl}/courses/${courseId}/topics/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMentorA}`,
        },
        body: JSON.stringify({
          items: [{ id: '99999999-9999-4999-a999-999999999999', displayOrder: 0 }],
        }),
      });

      assert.equal(res.status, 400);
      const data = (await res.json()) as { error?: { code: string; message: string } };
      assert.equal(data.error?.code, 'VALIDATION_ERROR');
      assert.match(data.error?.message ?? '', /does not belong to this course/);
    });

    void it('returns 400 Validation Error when reordering with duplicate item IDs', async () => {
      const res = await fetch(`${baseUrl}/courses/${courseId}/topics/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMentorA}`,
        },
        body: JSON.stringify({
          items: [
            { id: topicId, displayOrder: 0 },
            { id: topicId, displayOrder: 1 },
          ],
        }),
      });

      assert.equal(res.status, 400);
      const data = (await res.json()) as {
        error?: { code: string; message: string; details?: Array<{ message: string }> };
      };
      assert.equal(data.error?.code, 'VALIDATION_ERROR');
      const detailMsg = data.error?.details?.map((d) => d.message).join(' ') ?? '';
      assert.match(detailMsg, /Duplicate item IDs/);
    });
  });

  void describe('XSS Content Sanitization (CRS-23, FR-6.4)', () => {
    void it('strips <script> and onerror handlers from subtopic rich-text content', async () => {
      const mockTopic = {
        id: topicId,
        courseId,
      } as Topic;

      const mockCourse = {
        id: courseId,
        createdBy: mentorAId,
      } as Course;

      coursesRepository.findTopicById = () => Promise.resolve(mockTopic);
      coursesRepository.findCourseById = () => Promise.resolve(mockCourse);
      coursesRepository.getNextSubtopicOrder = () => Promise.resolve(0);
      coursesRepository.createSubtopic = (payload) =>
        Promise.resolve({
          id: 'subtopic-1-uuid',
          topicId,
          ...payload,
        } as Subtopic);

      const dirtyHtml =
        '<p>Safe Text</p><script>alert("xss")</script><img src="x" onerror="evil()"/>';

      const res = await fetch(`${baseUrl}/courses/topics/${topicId}/subtopics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMentorA}`,
        },
        body: JSON.stringify({
          title: 'Secure Subtopic',
          content: dirtyHtml,
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as {
        success: boolean;
        data?: { content: string };
      };
      assert.equal(data.success, true);
      const savedContent = data.data?.content ?? '';
      assert(!savedContent.includes('<script>'), 'script tag must be stripped');
      assert(!savedContent.includes('onerror'), 'onerror attribute must be stripped');
      assert(savedContent.includes('<p>Safe Text</p>'), 'safe html tags must be preserved');
    });
  });

  void describe('Delete Route Parameter Validation (M6-VAL-1)', () => {
    void it('returns 400 Validation Error for non-UUID on DELETE /topics/:id', async () => {
      const res = await fetch(`${baseUrl}/courses/topics/not-a-valid-uuid`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
        },
      });

      assert.equal(res.status, 400);
      const data = (await res.json()) as { error?: { code: string } };
      assert.equal(data.error?.code, 'VALIDATION_ERROR');
    });

    void it('returns 400 Validation Error for non-UUID on DELETE /subtopics/:id', async () => {
      const res = await fetch(`${baseUrl}/courses/subtopics/not-a-valid-uuid`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
        },
      });

      assert.equal(res.status, 400);
      const data = (await res.json()) as { error?: { code: string } };
      assert.equal(data.error?.code, 'VALIDATION_ERROR');
    });

    void it('returns 400 Validation Error for non-UUID on DELETE /assignments/:id', async () => {
      const res = await fetch(`${baseUrl}/courses/assignments/not-a-valid-uuid`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokenAdmin}`,
        },
      });

      assert.equal(res.status, 400);
      const data = (await res.json()) as { error?: { code: string } };
      assert.equal(data.error?.code, 'VALIDATION_ERROR');
    });
  });
});
