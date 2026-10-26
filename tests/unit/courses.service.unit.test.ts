import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { AuthenticatedUser } from '../../src/core/auth';
import { ForbiddenError, ValidationError } from '../../src/core/errors';
import {
  type Assignment,
  type Course,
  coursesRepository,
  coursesService,
  type Subtopic,
  type Topic,
} from '../../src/modules/courses';

type InternalCoursesService = {
  assertCanEdit: (course: Course, user: AuthenticatedUser) => void;
};

const createTestUser = (overrides: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@techeniac.com',
  role: 'MENTOR',
  mustChangePassword: false,
  tokenVersion: 1,
  ...overrides,
});

void describe('CoursesService Unit Tests', () => {
  void describe('assertCanEdit Authorization Guard (CRS-18)', () => {
    const course = {
      id: 'course-123',
      createdBy: 'mentor-1-id',
    } as Course;

    const superAdmin = createTestUser({
      id: 'admin-1-id',
      name: 'Super Admin',
      email: 'admin@techeniac.com',
      role: 'SUPER_ADMIN',
    });

    const courseCreator = createTestUser({
      id: 'mentor-1-id',
      name: 'Mentor Creator',
      email: 'creator@techeniac.com',
      role: 'MENTOR',
    });

    const anotherMentor = createTestUser({
      id: 'mentor-2-id',
      name: 'Another Mentor',
      email: 'other@techeniac.com',
      role: 'MENTOR',
    });

    const mentee = createTestUser({
      id: 'mentee-1-id',
      name: 'Mentee User',
      email: 'mentee@techeniac.com',
      role: 'MENTEE',
    });

    const service = coursesService as unknown as InternalCoursesService;

    void it('allows SUPER_ADMIN to modify any course', () => {
      assert.doesNotThrow(() => {
        service.assertCanEdit(course, superAdmin);
      });
    });

    void it('allows MENTOR who created the course to modify it', () => {
      assert.doesNotThrow(() => {
        service.assertCanEdit(course, courseCreator);
      });
    });

    void it('rejects MENTOR who did not create the course with ForbiddenError', () => {
      assert.throws(() => {
        service.assertCanEdit(course, anotherMentor);
      }, ForbiddenError);
    });

    void it('rejects MENTEE with ForbiddenError', () => {
      assert.throws(() => {
        service.assertCanEdit(course, mentee);
      }, ForbiddenError);
    });
  });

  void describe('Budget Mathematics & Constraints', () => {
    const user = createTestUser({
      id: 'mentor-1-id',
      name: 'Mentor Creator',
      email: 'creator@techeniac.com',
      role: 'MENTOR',
    });

    void it('rejects reducing course duration below total duration of its topics', async () => {
      const mockCourse = {
        id: 'c1',
        title: 'Fullstack Course',
        createdBy: user.id,
        updatedAt: new Date(),
        estimatedMinutes: 120,
        topics: [
          { id: 't1', estimatedMinutes: 60 },
          { id: 't2', estimatedMinutes: 40 },
        ] as Topic[],
      } as Course;

      coursesRepository.findCourseById = () => Promise.resolve(mockCourse);

      await assert.rejects(
        async () => {
          await coursesService.updateCourse('c1', { estimatedMinutes: 90 }, user);
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.match(err.message, /cannot be less than the total allocated duration/);
          return true;
        },
      );
    });

    void it('rejects creating topic whose duration exceeds course remaining budget', async () => {
      const mockCourse = {
        id: 'c1',
        title: 'Fullstack Course',
        createdBy: user.id,
        updatedAt: new Date(),
        estimatedMinutes: 100,
        topics: [{ id: 't1', estimatedMinutes: 70 }] as Topic[],
      } as Course;

      coursesRepository.findCourseById = () => Promise.resolve(mockCourse);

      await assert.rejects(
        async () => {
          await coursesService.createTopic(
            'c1',
            { title: 'New Topic', estimatedMinutes: 40 },
            user,
          );
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.match(err.message, /exceeds the course's remaining duration budget/);
          return true;
        },
      );
    });

    void it('rejects updating topic duration below total duration of its subtopics', async () => {
      const mockTopic = {
        id: 't1',
        courseId: 'c1',
        title: 'Topic 1',
        estimatedMinutes: 60,
        updatedAt: new Date(),
        subtopics: [
          { id: 'st1', estimatedMinutes: 30 },
          { id: 'st2', estimatedMinutes: 20 },
        ] as Subtopic[],
      } as Topic;

      const mockCourse = {
        id: 'c1',
        createdBy: user.id,
        topics: [mockTopic],
      } as Course;

      coursesRepository.findTopicById = () => Promise.resolve(mockTopic);
      coursesRepository.findCourseById = () => Promise.resolve(mockCourse);

      await assert.rejects(
        async () => {
          await coursesService.updateTopic('t1', { estimatedMinutes: 40 }, user);
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.match(err.message, /cannot be less than the total allocated duration/);
          return true;
        },
      );
    });

    void it('rejects creating subtopic whose duration exceeds topic remaining budget', async () => {
      const mockTopic = {
        id: 't1',
        courseId: 'c1',
        title: 'Topic 1',
        estimatedMinutes: 60,
        subtopics: [{ id: 'st1', estimatedMinutes: 45 }] as Subtopic[],
      } as Topic;

      const mockCourse = {
        id: 'c1',
        createdBy: user.id,
      } as Course;

      coursesRepository.findTopicById = () => Promise.resolve(mockTopic);
      coursesRepository.findCourseById = () => Promise.resolve(mockCourse);

      await assert.rejects(
        async () => {
          await coursesService.createSubtopic(
            't1',
            { title: 'Subtopic 2', estimatedMinutes: 20 },
            user,
          );
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.match(err.message, /exceeds topic "Topic 1" remaining duration budget/);
          return true;
        },
      );
    });
  });

  void describe('Assignment Marks Merging (CRS-08, FR-6.12)', () => {
    const user = createTestUser({
      id: 'mentor-1-id',
      name: 'Mentor Creator',
      email: 'creator@techeniac.com',
      role: 'MENTOR',
    });

    const mockAssignment = {
      id: 'assign-1',
      courseId: 'c1',
      maxMarks: 100,
      passMarks: 70,
      updatedAt: new Date(),
    } as Assignment;

    const mockCourse = {
      id: 'c1',
      createdBy: user.id,
    } as Course;

    beforeEach(() => {
      coursesRepository.findAssignmentById = () => Promise.resolve({ ...mockAssignment });
      coursesRepository.findCourseById = () => Promise.resolve(mockCourse);
    });

    void it('rejects updating passMarks alone when it exceeds existing maxMarks', async () => {
      await assert.rejects(
        async () => {
          await coursesService.updateAssignment('assign-1', { passMarks: 110 }, user);
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.equal(err.message, 'Pass marks cannot exceed max marks');
          return true;
        },
      );
    });

    void it('rejects updating maxMarks alone when it is less than existing passMarks', async () => {
      await assert.rejects(
        async () => {
          await coursesService.updateAssignment('assign-1', { maxMarks: 50 }, user);
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.equal(err.message, 'Pass marks cannot exceed max marks');
          return true;
        },
      );
    });

    void it('succeeds when merged passMarks is less than or equal to merged maxMarks', async () => {
      coursesRepository.updateAssignment = (_id, payload) =>
        Promise.resolve({
          ...mockAssignment,
          ...payload,
        });

      const updated = await coursesService.updateAssignment(
        'assign-1',
        { maxMarks: 120, passMarks: 80 },
        user,
      );
      assert.equal(updated.maxMarks, 120);
      assert.equal(updated.passMarks, 80);
    });
  });

  void describe('Reordering IDOR Ownership Checks', () => {
    const user = createTestUser({
      id: 'mentor-1-id',
      name: 'Mentor Creator',
      email: 'creator@techeniac.com',
      role: 'MENTOR',
    });

    void it('rejects reordering topics with a foreign topic ID', async () => {
      const mockCourse = {
        id: 'c1',
        createdBy: user.id,
        topics: [{ id: 'topic-belonging-to-c1' }] as Topic[],
      } as Course;

      coursesRepository.findCourseById = () => Promise.resolve(mockCourse);

      await assert.rejects(
        async () => {
          await coursesService.reorderTopics(
            'c1',
            [{ id: 'foreign-topic-uuid', displayOrder: 0 }],
            user,
          );
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.match(err.message, /does not belong to this course/);
          return true;
        },
      );
    });

    void it('rejects reordering subtopics with a foreign subtopic ID', async () => {
      const mockTopic = {
        id: 't1',
        courseId: 'c1',
        subtopics: [{ id: 'subtopic-belonging-to-t1' }] as Subtopic[],
      } as Topic;

      const mockCourse = {
        id: 'c1',
        createdBy: user.id,
      } as Course;

      coursesRepository.findTopicById = () => Promise.resolve(mockTopic);
      coursesRepository.findCourseById = () => Promise.resolve(mockCourse);

      await assert.rejects(
        async () => {
          await coursesService.reorderSubtopics(
            't1',
            [{ id: 'foreign-subtopic-uuid', displayOrder: 0 }],
            user,
          );
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.match(err.message, /does not belong to this topic/);
          return true;
        },
      );
    });

    void it('rejects reordering assignments with a foreign assignment ID', async () => {
      const mockCourse = {
        id: 'c1',
        createdBy: user.id,
        assignments: [{ id: 'assignment-belonging-to-c1' }] as Assignment[],
      } as Course;

      coursesRepository.findCourseById = () => Promise.resolve(mockCourse);

      await assert.rejects(
        async () => {
          await coursesService.reorderAssignments(
            'c1',
            [{ id: 'foreign-assignment-uuid', displayOrder: 0 }],
            user,
          );
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.match(err.message, /does not belong to this course/);
          return true;
        },
      );
    });
  });
});
