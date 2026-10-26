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
        body: JSON.stringify({ title: 'Hacked by Mentor B' }),
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
        body: JSON.stringify({ title: 'Admin Updated Title' }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        status: string;
        data?: { course: { title: string } };
      };
      assert.equal(data.status, 'success');
      assert.equal(data.data?.course?.title, 'Admin Updated Title');
    });
  });

  void describe('List Courses Defaults & Pagination (FR-6.6)', () => {
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
        status: string;
        data?: {
          courses: Course[];
          pagination: { page: number; limit: number; total: number; totalPages: number };
        };
      };

      assert.equal(data.status, 'success');
      assert.equal(data.data?.pagination.page, 1);
      assert.equal(data.data?.pagination.limit, 20);
      assert.equal(data.data?.pagination.total, 1);
      assert.equal(data.data?.courses.length, 1);
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
        status: string;
        data?: { subtopic: { content: string } };
      };
      assert.equal(data.status, 'success');
      const savedContent = data.data?.subtopic?.content ?? '';
      assert(!savedContent.includes('<script>'), 'script tag must be stripped');
      assert(!savedContent.includes('onerror'), 'onerror attribute must be stripped');
      assert(savedContent.includes('<p>Safe Text</p>'), 'safe html tags must be preserved');
    });
  });
});
