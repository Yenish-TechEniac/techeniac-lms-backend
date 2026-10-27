import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { AuthenticatedUser } from '../../src/core/auth';
import { emailService } from '../../src/core/email';
import { ForbiddenError, ValidationError } from '../../src/core/errors';
import { CourseTopicAction } from '../../src/core/lifecycle';
import { CourseAllocation, CourseAllocationStatus } from '../../src/modules/allocations';
import {
  Batch,
  BatchStatus,
  mentorMenteeRepository,
  mentorScopeHelper,
} from '../../src/modules/batches';
import type { Topic } from '../../src/modules/courses';
import {
  ProgressPolicy,
  ProgressRepository,
  ProgressService,
  TopicProgress,
  TopicProgressStatus,
  trackerQuerySchema,
  updateTopicDeadlineSchema,
  updateTopicStatusSchema,
} from '../../src/modules/progress';

const createTestUser = (overrides: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@techeniac.com',
  role: 'SUPER_ADMIN',
  mustChangePassword: false,
  tokenVersion: 1,
  ...overrides,
});

void describe('ProgressService Unit Tests (PRD M8: PRG-01 to PRG-20)', () => {
  let mockRepo: ProgressRepository;
  let mockPolicy: ProgressPolicy;
  let service: ProgressService;

  const adminUser = createTestUser({ id: 'admin-1', role: 'SUPER_ADMIN' });
  const mentorUser = createTestUser({ id: 'mentor-1', role: 'MENTOR' });
  const menteeUser = createTestUser({ id: 'mentee-1', role: 'MENTEE' });
  const otherMentee = createTestUser({ id: 'mentee-2', role: 'MENTEE' });

  const mockActiveTopics: Topic[] = [
    {
      id: 'topic-1',
      title: 'Intro',
      courseId: 'course-1',
      isActive: true,
      displayOrder: 1,
    } as Topic,
    {
      id: 'topic-2',
      title: 'Advanced',
      courseId: 'course-1',
      isActive: true,
      displayOrder: 2,
    } as Topic,
    {
      id: 'topic-3',
      title: 'Project',
      courseId: 'course-1',
      isActive: true,
      displayOrder: 3,
    } as Topic,
  ];

  beforeEach(() => {
    mockRepo = new ProgressRepository();
    mockPolicy = new ProgressPolicy();
    service = new ProgressService(mockRepo, mockPolicy);
    emailService.sendTopicDeadlineChangedEmail = () => Promise.resolve();
    emailService.sendAllocationCompletedEmail = () => Promise.resolve();
  });

  void describe('handleAllocationCreated (ALC-24, FR-7.1, M8)', () => {
    void it('initializes NOT_STARTED topic progress rows for all active topics', async () => {
      let capturedAllocationIds: string[] = [];
      let capturedTopicIds: string[] = [];

      mockRepo.findActiveTopicsByCourseId = () => Promise.resolve(mockActiveTopics);
      mockRepo.initializeTopicProgressForAllocations = (allocIds, topicIds) => {
        capturedAllocationIds = allocIds;
        capturedTopicIds = topicIds;
        return Promise.resolve();
      };

      await service.handleAllocationCreated({
        allocationIds: ['alloc-1', 'alloc-2'],
        courseId: 'course-1',
      });

      assert.deepEqual(capturedAllocationIds, ['alloc-1', 'alloc-2']);
      assert.deepEqual(capturedTopicIds, ['topic-1', 'topic-2', 'topic-3']);
    });

    void it('skips initialization safely when course has no active topics', async () => {
      let called = false;
      mockRepo.findActiveTopicsByCourseId = () => Promise.resolve([]);
      mockRepo.initializeTopicProgressForAllocations = () => {
        called = true;
        return Promise.resolve();
      };

      await service.handleAllocationCreated({
        allocationIds: ['alloc-1'],
        courseId: 'course-empty',
      });

      assert.equal(called, false);
    });

    void it('handles empty allocation IDs array gracefully', async () => {
      let called = false;
      mockRepo.findActiveTopicsByCourseId = () => Promise.resolve(mockActiveTopics);
      mockRepo.initializeTopicProgressForAllocations = () => {
        called = true;
        return Promise.resolve();
      };

      await service.handleAllocationCreated({
        allocationIds: [],
        courseId: 'course-1',
      });

      assert.equal(called, false);
    });
  });

  void describe('updateTopicStatus & Concurrency (FR-8.3, PRG-03..06, PRG-20)', () => {
    void it('allows mentee to move topic from NOT_STARTED to IN_PROGRESS (PRG-03)', async () => {
      const allocation = {
        id: 'alloc-1',
        userId: 'mentee-1',
        courseId: 'course-1',
        status: CourseAllocationStatus.ASSIGNED,
        progressPercent: 0,
        batch: { status: BatchStatus.LIVE } as Batch,
      } as CourseAllocation;

      const progress = {
        id: 'tp-1',
        courseAllocationId: 'alloc-1',
        topicId: 'topic-1',
        status: TopicProgressStatus.NOT_STARTED,
        completedAt: null,
      } as TopicProgress;

      mockRepo.findAllocationById = () => Promise.resolve(allocation);
      mockRepo.findByAllocationAndTopic = () => Promise.resolve(progress);
      mockRepo.save = (p) => Promise.resolve(p);
      mockRepo.findActiveTopicsByCourseId = () => Promise.resolve(mockActiveTopics);
      mockRepo.listByAllocationId = () =>
        Promise.resolve([
          { ...progress, status: TopicProgressStatus.IN_PROGRESS },
          { topicId: 'topic-2', status: TopicProgressStatus.NOT_STARTED } as TopicProgress,
          { topicId: 'topic-3', status: TopicProgressStatus.NOT_STARTED } as TopicProgress,
        ]);
      mockRepo.updateAllocationProgress = () => Promise.resolve();

      const result = await service.updateTopicStatus(
        'alloc-1',
        'topic-1',
        { status: TopicProgressStatus.IN_PROGRESS, note: 'Working on lab' },
        menteeUser,
      );

      assert.equal(result.topicProgress.status, TopicProgressStatus.IN_PROGRESS);
      assert.equal(result.topicProgress.note, 'Working on lab');
      assert.equal(result.allocation.status, CourseAllocationStatus.IN_PROGRESS);
    });

    void it('rejects another mentee from updating topic status (PRG-10)', async () => {
      const allocation = {
        id: 'alloc-1',
        userId: 'mentee-1',
        status: CourseAllocationStatus.ASSIGNED,
        batch: { status: BatchStatus.LIVE } as Batch,
      } as CourseAllocation;

      mockRepo.findAllocationById = () => Promise.resolve(allocation);

      await assert.rejects(
        () =>
          service.updateTopicStatus(
            'alloc-1',
            'topic-1',
            { status: TopicProgressStatus.IN_PROGRESS },
            otherMentee,
          ),
        (err: unknown) => err instanceof ForbiddenError,
      );
    });

    void it('rejects updating topic status when allocation is completed or revoked (PRG-13)', async () => {
      const completedAllocation = {
        id: 'alloc-1',
        userId: 'mentee-1',
        status: CourseAllocationStatus.COMPLETED,
        batch: { status: BatchStatus.LIVE } as Batch,
      } as CourseAllocation;

      mockRepo.findAllocationById = () => Promise.resolve(completedAllocation);

      await assert.rejects(
        () =>
          service.updateTopicStatus(
            'alloc-1',
            'topic-1',
            { status: TopicProgressStatus.IN_PROGRESS },
            menteeUser,
          ),
        (err: unknown) => err instanceof ForbiddenError,
      );
    });

    void it('rejects updating topic status when batch is in ON_HOLD status (PRG-12)', async () => {
      const onHoldAllocation = {
        id: 'alloc-1',
        userId: 'mentee-1',
        status: CourseAllocationStatus.IN_PROGRESS,
        batch: { status: BatchStatus.ON_HOLD } as Batch,
      } as CourseAllocation;

      mockRepo.findAllocationById = () => Promise.resolve(onHoldAllocation);

      await assert.rejects(
        () =>
          service.updateTopicStatus(
            'alloc-1',
            'topic-1',
            { status: TopicProgressStatus.COMPLETED },
            menteeUser,
          ),
        (err: unknown) => err instanceof ForbiddenError,
      );
    });
  });

  void describe('updateTopicDeadline & Validation (FR-8.6, PRG-17, PRG-18)', () => {
    void it('allows mentor to set deadline within start and due date range (PRG-17)', async () => {
      const allocation = {
        id: 'alloc-1',
        userId: 'mentee-1',
        batchId: 'batch-1',
        courseId: 'course-1',
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-30T00:00:00.000Z'),
        user: { email: 'mentee@techeniac.com', name: 'Mentee' },
        course: { title: 'TypeScript' },
      } as unknown as CourseAllocation;

      const progress = {
        topicId: 'topic-1',
        deadline: null,
      } as TopicProgress;

      mentorScopeHelper.requireMentorScope = () => Promise.resolve();
      mockRepo.findAllocationById = () => Promise.resolve(allocation);
      mockRepo.findTopicById = () => Promise.resolve({ id: 'topic-1', title: 'Intro' } as Topic);
      mockRepo.findByAllocationAndTopic = () => Promise.resolve(progress);
      mockRepo.save = (p) => Promise.resolve(p);

      const targetDeadline = '2026-11-15T18:00:00.000Z';
      const result = await service.updateTopicDeadline(
        'alloc-1',
        'topic-1',
        { deadline: targetDeadline },
        mentorUser,
      );

      assert.equal(result.deadline, targetDeadline);
      assert.equal(result.topicId, 'topic-1');
    });

    void it('allows super admin to set topic deadline without batch restriction', async () => {
      const allocation = {
        id: 'alloc-1',
        userId: 'mentee-1',
        courseId: 'course-1',
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-30T00:00:00.000Z'),
        user: { email: 'mentee@techeniac.com', name: 'Mentee' },
        course: { title: 'TypeScript' },
      } as unknown as CourseAllocation;

      const progress = {
        topicId: 'topic-1',
        deadline: null,
      } as TopicProgress;

      mockRepo.findAllocationById = () => Promise.resolve(allocation);
      mockRepo.findTopicById = () => Promise.resolve({ id: 'topic-1', title: 'Intro' } as Topic);
      mockRepo.findByAllocationAndTopic = () => Promise.resolve(progress);
      mockRepo.save = (p) => Promise.resolve(p);

      const targetDeadline = '2026-11-20T00:00:00.000Z';
      const result = await service.updateTopicDeadline(
        'alloc-1',
        'topic-1',
        { deadline: targetDeadline },
        adminUser,
      );

      assert.equal(result.deadline, targetDeadline);
    });

    void it('rejects setting topic deadline outside start and due range with ValidationError (PRG-18)', async () => {
      const allocation = {
        id: 'alloc-1',
        userId: 'mentee-1',
        batchId: 'batch-1',
        courseId: 'course-1',
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-30T00:00:00.000Z'),
      } as CourseAllocation;

      mentorScopeHelper.requireMentorScope = () => Promise.resolve();
      mockRepo.findAllocationById = () => Promise.resolve(allocation);

      // Deadline after allocation due date
      await assert.rejects(
        () =>
          service.updateTopicDeadline(
            'alloc-1',
            'topic-1',
            { deadline: '2026-12-05T00:00:00.000Z' },
            mentorUser,
          ),
        (err: unknown) => err instanceof ValidationError,
      );

      // Deadline before allocation start date
      await assert.rejects(
        () =>
          service.updateTopicDeadline(
            'alloc-1',
            'topic-1',
            { deadline: '2026-10-25T00:00:00.000Z' },
            mentorUser,
          ),
        (err: unknown) => err instanceof ValidationError,
      );
    });

    void it('rejects mentee from setting topic deadline (FR-8.6)', async () => {
      const allocation = {
        id: 'alloc-1',
        userId: 'mentee-1',
        startDate: new Date('2026-11-01'),
        dueDate: new Date('2026-11-30'),
      } as CourseAllocation;

      mockRepo.findAllocationById = () => Promise.resolve(allocation);

      await assert.rejects(
        () =>
          service.updateTopicDeadline(
            'alloc-1',
            'topic-1',
            { deadline: '2026-11-15T00:00:00.000Z' },
            menteeUser,
          ),
        (err: unknown) => err instanceof ForbiddenError,
      );
    });
  });

  void describe('getTopicProgressForAllocation (FR-8.1, FR-8.2)', () => {
    void it('returns full outline with calculated isOverdue for topic and allocation', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 86400000); // 1 day ago
      const futureDate = new Date(now.getTime() + 86400000); // 1 day ahead

      const allocation = {
        id: 'alloc-1',
        userId: 'mentee-1',
        courseId: 'course-1',
        startDate: pastDate,
        dueDate: futureDate,
        status: CourseAllocationStatus.IN_PROGRESS,
        progressPercent: 33.33,
        course: { title: 'TypeScript' },
      } as CourseAllocation;

      const progressRows: TopicProgress[] = [
        {
          topicId: 'topic-1',
          status: TopicProgressStatus.COMPLETED,
          deadline: pastDate,
        } as TopicProgress,
        {
          topicId: 'topic-2',
          status: TopicProgressStatus.IN_PROGRESS,
          deadline: pastDate,
        } as TopicProgress,
        {
          topicId: 'topic-3',
          status: TopicProgressStatus.NOT_STARTED,
          deadline: futureDate,
        } as TopicProgress,
      ];

      mockRepo.findAllocationById = () => Promise.resolve(allocation);
      mockRepo.findActiveTopicsByCourseId = () => Promise.resolve(mockActiveTopics);
      mockRepo.listByAllocationId = () => Promise.resolve(progressRows);

      const overview = await service.getTopicProgressForAllocation('alloc-1', menteeUser);

      assert.equal(overview.allocation.progressPercent, 33.33);
      assert.equal(overview.allocation.isOverdue, false); // due date is in the future
      assert.equal(overview.topics.length, 3);

      // Topic 1 is completed so it is not overdue even though deadline passed
      assert.equal(overview.topics[0]?.isOverdue, false);
      // Topic 2 is incomplete and deadline passed -> overdue!
      assert.equal(overview.topics[1]?.isOverdue, true);
      // Topic 3 deadline is in future -> not overdue
      assert.equal(overview.topics[2]?.isOverdue, false);
    });
  });

  void describe('recalculateProgress (FR-8.4, FR-8.5)', () => {
    void it('transitions ASSIGNED to IN_PROGRESS when a topic is in progress or completed', async () => {
      const allocation = {
        id: 'alloc-1',
        courseId: 'course-1',
        status: CourseAllocationStatus.ASSIGNED,
        progressPercent: 0,
        completedAt: null,
      } as CourseAllocation;

      const progressRows: TopicProgress[] = [
        { topicId: 'topic-1', status: TopicProgressStatus.COMPLETED } as TopicProgress,
        { topicId: 'topic-2', status: TopicProgressStatus.NOT_STARTED } as TopicProgress,
        { topicId: 'topic-3', status: TopicProgressStatus.NOT_STARTED } as TopicProgress,
      ];

      mockRepo.findAllocationById = () => Promise.resolve(allocation);
      mockRepo.findActiveTopicsByCourseId = () => Promise.resolve(mockActiveTopics);
      mockRepo.listByAllocationId = () => Promise.resolve(progressRows);

      let capturedUpdate: { progressPercent: number; status?: CourseAllocationStatus } | null =
        null;
      mockRepo.updateAllocationProgress = (_id, updates) => {
        capturedUpdate = updates;
        return Promise.resolve();
      };

      const result = await service.recalculateProgress('alloc-1');

      assert.equal(result.progressPercent, 33.33);
      assert.equal(result.status, CourseAllocationStatus.IN_PROGRESS);
      assert.equal(capturedUpdate?.progressPercent, 33.33);
      assert.equal(capturedUpdate?.status, CourseAllocationStatus.IN_PROGRESS);
    });

    void it('reverts IN_PROGRESS allocation back to ASSIGNED when topics are reverted to NOT_STARTED', async () => {
      const allocation = {
        id: 'alloc-1',
        courseId: 'course-1',
        status: CourseAllocationStatus.IN_PROGRESS,
        progressPercent: 33.33,
        completedAt: null,
      } as CourseAllocation;

      const progressRows: TopicProgress[] = [
        { topicId: 'topic-1', status: TopicProgressStatus.NOT_STARTED } as TopicProgress,
        { topicId: 'topic-2', status: TopicProgressStatus.NOT_STARTED } as TopicProgress,
        { topicId: 'topic-3', status: TopicProgressStatus.NOT_STARTED } as TopicProgress,
      ];

      mockRepo.findAllocationById = () => Promise.resolve(allocation);
      mockRepo.findActiveTopicsByCourseId = () => Promise.resolve(mockActiveTopics);
      mockRepo.listByAllocationId = () => Promise.resolve(progressRows);

      let capturedUpdate: { progressPercent: number; status?: CourseAllocationStatus } | null =
        null;
      mockRepo.updateAllocationProgress = (_id, updates) => {
        capturedUpdate = updates;
        return Promise.resolve();
      };

      const result = await service.recalculateProgress('alloc-1');

      assert.equal(result.progressPercent, 0);
      assert.equal(result.status, CourseAllocationStatus.ASSIGNED);
      assert.equal(capturedUpdate?.progressPercent, 0);
      assert.equal(capturedUpdate?.status, CourseAllocationStatus.ASSIGNED);
    });

    void it('transitions to COMPLETED with 100% when all active topics are completed', async () => {
      const allocation = {
        id: 'alloc-1',
        courseId: 'course-1',
        status: CourseAllocationStatus.IN_PROGRESS,
        progressPercent: 66.67,
        completedAt: null,
      } as CourseAllocation;

      const progressRows: TopicProgress[] = [
        { topicId: 'topic-1', status: TopicProgressStatus.COMPLETED } as TopicProgress,
        { topicId: 'topic-2', status: TopicProgressStatus.COMPLETED } as TopicProgress,
        { topicId: 'topic-3', status: TopicProgressStatus.COMPLETED } as TopicProgress,
      ];

      mockRepo.findAllocationById = () => Promise.resolve(allocation);
      mockRepo.findActiveTopicsByCourseId = () => Promise.resolve(mockActiveTopics);
      mockRepo.listByAllocationId = () => Promise.resolve(progressRows);

      let capturedUpdate: {
        progressPercent: number;
        status?: CourseAllocationStatus;
        completedAt?: Date | null;
      } | null = null;

      mockRepo.updateAllocationProgress = (_id, updates) => {
        capturedUpdate = updates;
        return Promise.resolve();
      };

      const result = await service.recalculateProgress('alloc-1');

      assert.equal(result.progressPercent, 100);
      assert.equal(result.status, CourseAllocationStatus.COMPLETED);
      assert.equal(capturedUpdate?.progressPercent, 100);
      assert.equal(capturedUpdate?.status, CourseAllocationStatus.COMPLETED);
      assert.ok(capturedUpdate?.completedAt instanceof Date);
    });

    void it('freezes COMPLETED allocations and never recalculates or reopens them (FR-8.4)', async () => {
      const allocation = {
        id: 'alloc-1',
        courseId: 'course-1',
        status: CourseAllocationStatus.COMPLETED,
        progressPercent: 100,
        completedAt: new Date('2026-10-01'),
      } as CourseAllocation;

      mockRepo.findAllocationById = () => Promise.resolve(allocation);

      let updateCalled = false;
      mockRepo.updateAllocationProgress = () => {
        updateCalled = true;
        return Promise.resolve();
      };

      const result = await service.recalculateProgress('alloc-1');

      assert.equal(result.progressPercent, 100);
      assert.equal(result.status, CourseAllocationStatus.COMPLETED);
      assert.equal(updateCalled, false);
    });

    void it('freezes REVOKED and CLOSED_* allocations without recalculating (FR-8.8)', async () => {
      const allocation = {
        id: 'alloc-revoked',
        courseId: 'course-1',
        status: CourseAllocationStatus.REVOKED,
        progressPercent: 50,
        completedAt: null,
      } as CourseAllocation;

      mockRepo.findAllocationById = () => Promise.resolve(allocation);

      let updateCalled = false;
      mockRepo.updateAllocationProgress = () => {
        updateCalled = true;
        return Promise.resolve();
      };

      const result = await service.recalculateProgress('alloc-revoked');

      assert.equal(result.progressPercent, 50);
      assert.equal(result.status, CourseAllocationStatus.REVOKED);
      assert.equal(updateCalled, false);
    });
  });

  void describe('handleCourseTopicsChanged (FR-6.15, PRG-15, PRG-16)', () => {
    void it('initializes new topic and recalculates all open allocations when topic is added', async () => {
      const openAllocations = [
        { id: 'alloc-1', courseId: 'course-1' } as CourseAllocation,
        { id: 'alloc-2', courseId: 'course-1' } as CourseAllocation,
      ];

      mockRepo.findOpenAllocationsByCourseId = () => Promise.resolve(openAllocations);

      let initializedAllocIds: string[] = [];
      let initializedTopicIds: string[] = [];
      mockRepo.initializeTopicProgressForAllocations = (aIds, tIds) => {
        initializedAllocIds = aIds;
        initializedTopicIds = tIds;
        return Promise.resolve();
      };

      const recalculatedIds: string[] = [];
      mockRepo.findAllocationById = (id) =>
        Promise.resolve({
          id,
          courseId: 'course-1',
          status: CourseAllocationStatus.IN_PROGRESS,
          progressPercent: 50,
        } as CourseAllocation);
      mockRepo.findActiveTopicsByCourseId = () => Promise.resolve(mockActiveTopics);
      mockRepo.listByAllocationId = () => Promise.resolve([]);
      mockRepo.updateAllocationProgress = (id) => {
        recalculatedIds.push(id);
        return Promise.resolve();
      };

      await service.handleCourseTopicsChanged({
        courseId: 'course-1',
        topicId: 'topic-new',
        action: CourseTopicAction.ADDED,
      });

      assert.deepEqual(initializedAllocIds, ['alloc-1', 'alloc-2']);
      assert.deepEqual(initializedTopicIds, ['topic-new']);
      assert.deepEqual(recalculatedIds, ['alloc-1', 'alloc-2']);
    });
  });

  void describe('getProgressTracker (FR-8.7)', () => {
    void it('aggregates progress counts and active topics in batch without N+1 queries', async () => {
      const mockAllocations: CourseAllocation[] = [
        {
          id: 'alloc-1',
          userId: 'mentee-1',
          user: { name: 'Mentee One' },
          batchId: 'batch-1',
          batch: { name: 'Batch Alpha' },
          courseId: 'course-1',
          course: { title: 'Node.js Core' },
          dueDate: new Date(Date.now() + 86400000),
          progressPercent: 66.67,
          status: CourseAllocationStatus.IN_PROGRESS,
        } as unknown as CourseAllocation,
      ];

      mockRepo.listTrackers = (opts) => {
        assert.equal(opts.limit, 50);
        return Promise.resolve({ allocations: mockAllocations, total: 1 });
      };

      mockRepo.findActiveTopicsByCourseIds = (courseIds) => {
        assert.deepEqual(courseIds, ['course-1']);
        return Promise.resolve(mockActiveTopics);
      };

      mockRepo.listByAllocationIds = (allocIds) => {
        assert.deepEqual(allocIds, ['alloc-1']);
        return Promise.resolve([
          {
            topicId: 'topic-1',
            courseAllocationId: 'alloc-1',
            status: TopicProgressStatus.COMPLETED,
          } as TopicProgress,
          {
            topicId: 'topic-2',
            courseAllocationId: 'alloc-1',
            status: TopicProgressStatus.COMPLETED,
          } as TopicProgress,
        ]);
      };

      const result = await service.getProgressTracker({ page: 1, limit: 50 }, adminUser);

      assert.equal(result.trackers.length, 1);
      assert.equal(result.trackers[0].allocationId, 'alloc-1');
      assert.equal(result.trackers[0].totalActiveTopics, 3);
      assert.equal(result.trackers[0].completedTopicsCount, 2);
      assert.equal(result.trackers[0].overdueTopicsCount, 0);
      assert.equal(result.trackers[0].isOverdue, false);
      assert.equal(result.pagination.total, 1);
    });

    void it('returns empty trackers when actor is MENTOR with no active mentor mappings', async () => {
      mentorMenteeRepository.findActiveMappingsForMentor = () => Promise.resolve([]);

      const result = await service.getProgressTracker({ batchId: 'batch-1' }, mentorUser);

      assert.equal(result.trackers.length, 0);
      assert.equal(result.pagination.total, 0);
    });
  });

  void describe('Schema Validation', () => {
    void it('validates correct updateTopicStatus payload', () => {
      const valid = updateTopicStatusSchema.safeParse({
        status: 'IN_PROGRESS',
        note: 'Starting lab 1',
      });
      assert.equal(valid.success, true);
    });

    void it('rejects invalid topic status', () => {
      const invalid = updateTopicStatusSchema.safeParse({
        status: 'UNKNOWN_STATUS',
      });
      assert.equal(invalid.success, false);
    });

    void it('validates correct ISO 8601 deadline', () => {
      const valid = updateTopicDeadlineSchema.safeParse({
        deadline: '2026-11-15T18:00:00.000Z',
      });
      assert.equal(valid.success, true);
    });

    void it('rejects non-ISO deadline string', () => {
      const invalid = updateTopicDeadlineSchema.safeParse({
        deadline: 'next-friday',
      });
      assert.equal(invalid.success, false);
    });

    void it('validates trackerQuerySchema with defaults and pagination bounds', () => {
      const parsed = trackerQuerySchema.parse({});
      assert.equal(parsed.page, 1);
      assert.equal(parsed.limit, 20);

      const invalidLimit = trackerQuerySchema.safeParse({ limit: 500 });
      assert.equal(invalidLimit.success, false);
    });
  });
});
