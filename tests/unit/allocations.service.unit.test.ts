import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { AuthenticatedUser } from '../../src/core/auth';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../src/core/errors';
import {
  allocationsRepository,
  allocationsService,
  CourseAllocation,
  CourseAllocationStatus,
} from '../../src/modules/allocations';
import { type Batch, BatchMember, BatchMemberRole, BatchStatus } from '../../src/modules/batches';
import type { Course } from '../../src/modules/courses';
import type { User, UserRole } from '../../src/modules/users';

const createTestUser = (overrides: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@techeniac.com',
  role: 'SUPER_ADMIN',
  mustChangePassword: false,
  tokenVersion: 1,
  ...overrides,
});

void describe('AllocationsService Unit Tests (PRD M7: ALC-01 to ALC-24)', () => {
  const adminUser = createTestUser({ id: 'admin-1', role: 'SUPER_ADMIN' });
  const mentorUser = createTestUser({ id: 'mentor-1', role: 'MENTOR' });

  const activeCourse = {
    id: 'course-1',
    title: 'TypeScript Essentials',
    isActive: true,
    estimatedMinutes: 120, // 2 hours
  } as Course;

  const inactiveCourse = {
    id: 'course-inactive',
    title: 'Legacy Cobol',
    isActive: false,
    estimatedMinutes: 60,
  } as Course;

  const liveBatch = {
    id: 'batch-1',
    name: 'Batch Alfa',
    code: 'ALFA-2026',
    status: BatchStatus.LIVE,
  } as unknown as Batch;

  const draftBatch = {
    id: 'batch-draft',
    name: 'Batch Beta Draft',
    code: 'BETA-2026',
    status: BatchStatus.DRAFT,
  } as unknown as Batch;

  const archivedBatch = {
    id: 'batch-archived',
    name: 'Batch Gamma Archived',
    code: 'GAMMA-2025',
    status: BatchStatus.ARCHIVED,
  } as unknown as Batch;

  beforeEach(() => {
    allocationsRepository.findCourseById = (id: string) => {
      if (id === activeCourse.id) return Promise.resolve(activeCourse);
      if (id === inactiveCourse.id) return Promise.resolve(inactiveCourse);
      return Promise.resolve(null);
    };

    allocationsRepository.findBatchById = (id: string) => {
      if (id === liveBatch.id) return Promise.resolve(liveBatch);
      if (id === draftBatch.id) return Promise.resolve(draftBatch);
      if (id === archivedBatch.id) return Promise.resolve(archivedBatch);
      return Promise.resolve(null);
    };

    allocationsRepository.findUsersByIds = (ids: string[]) => {
      const mockUsers = ids.map((id) => ({
        id,
        name: `User ${id}`,
        email: `${id}@techeniac.com`,
        role: (id.startsWith('mentor') ? 'MENTOR' : 'MENTEE') as UserRole,
        isActive: true,
      })) as unknown as User[];
      return Promise.resolve(mockUsers);
    };

    allocationsRepository.findBatchMember = (
      batchId: string,
      userId: string,
      role: BatchMemberRole,
    ) => {
      if (userId === 'mentor-1' && batchId === 'batch-1' && role === BatchMemberRole.MENTOR) {
        return Promise.resolve({
          id: 'bm-1',
          batchId,
          userId,
          memberRole: role,
          isActive: true,
        } as unknown as BatchMember);
      }
      if (userId === 'mentee-1' && batchId === 'batch-1' && role === BatchMemberRole.MENTEE) {
        return Promise.resolve({
          id: 'bm-2',
          batchId,
          userId,
          memberRole: role,
          isActive: true,
        } as unknown as BatchMember);
      }
      return Promise.resolve(null);
    };

    allocationsRepository.findActiveBatchMenteeMembers = (batchId: string) => {
      if (batchId === 'batch-1') {
        return Promise.resolve([
          { userId: 'mentee-1' },
          { userId: 'mentee-2' },
          { userId: 'mentee-3' },
        ] as unknown as BatchMember[]);
      }
      return Promise.resolve([]);
    };

    allocationsRepository.findActiveBatchMenteesByUserIds = (
      batchId: string,
      userIds: string[],
    ) => {
      const members = userIds
        .filter((id) => batchId === 'batch-1' && id !== 'mentee-alien-to-batch')
        .map(
          (id) =>
            ({
              id: `bm-${id}`,
              batchId,
              userId: id,
              memberRole: BatchMemberRole.MENTEE,
              isActive: true,
            }) as unknown as BatchMember,
        );
      return Promise.resolve(members);
    };

    allocationsRepository.findOpenAllocationsForMentees = () => Promise.resolve([]);

    allocationsRepository.saveAllocations = (allocs: CourseAllocation[]) => {
      const saved = allocs.map((a, idx) => {
        a.id = `alloc-${idx + 1}`;
        return a;
      });
      return Promise.resolve(saved);
    };
  });

  void describe('Course Status & Date Validation (ALC-01, 10, 11, 12, 22, 23)', () => {
    void it('rejects allocating an inactive course (FR-270)', async () => {
      await assert.rejects(
        async () => {
          await allocationsService.createAllocations(
            {
              courseId: inactiveCourse.id,
              targetType: 'INDIVIDUAL_MENTEES',
              menteeIds: ['mentee-1'],
              startDate: '2026-11-01T00:00:00.000Z',
            },
            adminUser,
          );
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.match(err.message, /Cannot allocate an inactive course/);
          return true;
        },
      );
    });

    void it('rejects when course has no estimated minutes and no due date is provided (ALC-11)', async () => {
      const courseWithoutEstimate = {
        ...activeCourse,
        id: 'course-no-est',
        estimatedMinutes: null,
      };
      allocationsRepository.findCourseById = () => Promise.resolve(courseWithoutEstimate);

      await assert.rejects(
        async () => {
          await allocationsService.createAllocations(
            {
              courseId: 'course-no-est',
              targetType: 'INDIVIDUAL_MENTEES',
              menteeIds: ['mentee-1'],
              startDate: '2026-11-01T00:00:00.000Z',
            },
            adminUser,
          );
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.match(err.message, /no estimated minutes and no due date/);
          return true;
        },
      );
    });

    void it('rejects when due date is earlier than start date (ALC-12)', async () => {
      await assert.rejects(
        async () => {
          await allocationsService.createAllocations(
            {
              courseId: activeCourse.id,
              targetType: 'INDIVIDUAL_MENTEES',
              menteeIds: ['mentee-1'],
              startDate: '2026-11-05T00:00:00.000Z',
              dueDate: '2026-11-01T00:00:00.000Z',
            },
            adminUser,
          );
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.match(err.message, /Due date earlier than start date/);
          return true;
        },
      );
    });

    void it('calculates default due date from start date + course estimated minutes (ALC-10)', async () => {
      const result = await allocationsService.createAllocations(
        {
          courseId: activeCourse.id,
          targetType: 'INDIVIDUAL_MENTEES',
          menteeIds: ['mentee-1'],
          startDate: '2026-11-01T10:00:00.000Z',
        },
        adminUser,
      );

      assert.equal(result.created.length, 1);
      const expectedDue = new Date(
        new Date('2026-11-01T10:00:00.000Z').getTime() + 120 * 60 * 1000,
      );
      assert.equal(result.created[0].dueDate.toISOString(), expectedDue.toISOString());
    });

    void it('rejects assigning to Archived batches (ALC-22)', async () => {
      await assert.rejects(
        async () => {
          await allocationsService.createAllocations(
            {
              courseId: activeCourse.id,
              targetType: 'BATCH',
              batchId: archivedBatch.id,
              startDate: '2026-11-01T00:00:00.000Z',
            },
            adminUser,
          );
        },
        (err: unknown) => {
          assert(err instanceof ForbiddenError);
          assert.match(err.message, /Only DRAFT and LIVE batches can receive allocations/);
          return true;
        },
      );
    });

    void it('allows assigning to Draft batches (ALC-23)', async () => {
      allocationsRepository.findActiveBatchMenteeMembers = () =>
        Promise.resolve([{ userId: 'mentee-1' }] as unknown as BatchMember[]);

      const result = await allocationsService.createAllocations(
        {
          courseId: activeCourse.id,
          targetType: 'BATCH',
          batchId: draftBatch.id,
          startDate: '2026-11-01T00:00:00.000Z',
        },
        adminUser,
      );

      assert.equal(result.created.length, 1);
      assert.equal(result.created[0].batchId, draftBatch.id);
    });
  });

  void describe('Role & Mentor Scope Validation (ALC-04, 05, 06, 07, 08, 09)', () => {
    void it('allows Super Admin to assign to individual mentees outside any batch with batchId null (ALC-04)', async () => {
      const result = await allocationsService.createAllocations(
        {
          courseId: activeCourse.id,
          targetType: 'INDIVIDUAL_MENTEES',
          menteeIds: ['mentee-1'],
          startDate: '2026-11-01T00:00:00.000Z',
        },
        adminUser,
      );

      assert.equal(result.created.length, 1);
      assert.equal(result.created[0].batchId, null);
    });

    void it('rejects Mentor from assigning to individual mentees outside a batch (ALC-04, FR-7.1c)', async () => {
      await assert.rejects(
        async () => {
          await allocationsService.createAllocations(
            {
              courseId: activeCourse.id,
              targetType: 'INDIVIDUAL_MENTEES',
              menteeIds: ['mentee-1'],
              startDate: '2026-11-01T00:00:00.000Z',
            },
            mentorUser,
          );
        },
        (err: unknown) => {
          assert(err instanceof ForbiddenError);
          assert.match(err.message, /Mentors can only allocate courses to batches/);
          return true;
        },
      );
    });

    void it('allows Mentor to assign to a batch where they are an active mentor (ALC-05)', async () => {
      const result = await allocationsService.createAllocations(
        {
          courseId: activeCourse.id,
          targetType: 'BATCH',
          batchId: liveBatch.id,
          startDate: '2026-11-01T00:00:00.000Z',
        },
        mentorUser,
      );

      assert.equal(result.created.length, 3);
      assert.equal(result.created[0].batchId, liveBatch.id);
    });

    void it('rejects Mentor trying to assign to a batch where they are not a member with 403 (ALC-06)', async () => {
      const otherMentor = createTestUser({ id: 'mentor-stranger', role: 'MENTOR' });

      await assert.rejects(
        async () => {
          await allocationsService.createAllocations(
            {
              courseId: activeCourse.id,
              targetType: 'BATCH',
              batchId: liveBatch.id,
              startDate: '2026-11-01T00:00:00.000Z',
            },
            otherMentor,
          );
        },
        (err: unknown) => {
          assert(err instanceof ForbiddenError);
          assert.match(
            err.message,
            /Mentor cannot assign courses to a batch where they are not an active member/,
          );
          return true;
        },
      );
    });

    void it('rejects Mentor trying to select a mentee outside their batch (ALC-07)', async () => {
      await assert.rejects(
        async () => {
          await allocationsService.createAllocations(
            {
              courseId: activeCourse.id,
              targetType: 'SELECTED_MENTEES',
              batchId: liveBatch.id,
              menteeIds: ['mentee-alien-to-batch'],
              startDate: '2026-11-01T00:00:00.000Z',
            },
            mentorUser,
          );
        },
        (err: unknown) => {
          assert(err instanceof ForbiddenError);
          assert.match(err.message, /Selected mentee.*not active mentee member/);
          return true;
        },
      );
    });

    void it('rejects Super Admin trying to select a mentee outside the specified batch in SELECTED_MENTEES', async () => {
      await assert.rejects(
        async () => {
          await allocationsService.createAllocations(
            {
              courseId: activeCourse.id,
              targetType: 'SELECTED_MENTEES',
              batchId: liveBatch.id,
              menteeIds: ['mentee-alien-to-batch'],
              startDate: '2026-11-01T00:00:00.000Z',
            },
            adminUser,
          );
        },
        (err: unknown) => {
          assert(err instanceof ForbiddenError);
          assert.match(err.message, /Selected mentee.*not active mentee member/);
          return true;
        },
      );
    });

    void it('rejects when requested mentee ID is not found in database', async () => {
      allocationsRepository.findUsersByIds = () => Promise.resolve([]);
      await assert.rejects(
        async () => {
          await allocationsService.createAllocations(
            {
              courseId: activeCourse.id,
              targetType: 'INDIVIDUAL_MENTEES',
              menteeIds: ['00000000-0000-0000-0000-000000000000'],
              startDate: '2026-11-01T00:00:00.000Z',
            },
            adminUser,
          );
        },
        (err: unknown) => {
          assert(err instanceof NotFoundError);
          assert.match(err.message, /Mentee\(s\) not found/);
          return true;
        },
      );
    });

    void it('rejects assigning course to a user whose role is MENTOR or SUPER_ADMIN (ALC-09)', async () => {
      await assert.rejects(
        async () => {
          await allocationsService.createAllocations(
            {
              courseId: activeCourse.id,
              targetType: 'INDIVIDUAL_MENTEES',
              menteeIds: ['mentor-target'],
              startDate: '2026-11-01T00:00:00.000Z',
            },
            adminUser,
          );
        },
        (err: unknown) => {
          assert(err instanceof ForbiddenError);
          assert.match(err.message, /Courses can be assigned to mentees only/);
          return true;
        },
      );
    });
  });

  void describe('Duplicate Prevention & Bulk Skip Rules (ALC-13, 21)', () => {
    void it('rejects individual mentee assignment if mentee already has an open allocation (ALC-13)', async () => {
      allocationsRepository.findOpenAllocationsForMentees = () =>
        Promise.resolve([
          { userId: 'mentee-1', courseId: activeCourse.id } as unknown as CourseAllocation,
        ]);

      await assert.rejects(
        async () => {
          await allocationsService.createAllocations(
            {
              courseId: activeCourse.id,
              targetType: 'INDIVIDUAL_MENTEES',
              menteeIds: ['mentee-1'],
              startDate: '2026-11-01T00:00:00.000Z',
            },
            adminUser,
          );
        },
        (err: unknown) => {
          assert(err instanceof ConflictError);
          assert.match(err.message, /already has an open allocation of the same course/);
          return true;
        },
      );
    });

    void it('skips duplicate open allocations in bulk batch assignments without failing (ALC-21)', async () => {
      allocationsRepository.findOpenAllocationsForMentees = () =>
        Promise.resolve([
          { userId: 'mentee-2', courseId: activeCourse.id } as unknown as CourseAllocation,
        ]);

      const result = await allocationsService.createAllocations(
        {
          courseId: activeCourse.id,
          targetType: 'BATCH',
          batchId: liveBatch.id,
          startDate: '2026-11-01T00:00:00.000Z',
        },
        adminUser,
      );

      assert.equal(result.created.length, 2);
      assert.equal(result.skipped.length, 1);
      assert.equal(result.skipped[0].menteeId, 'mentee-2');
    });
  });

  void describe('Allocation Updates & Revocation (ALC-17, 18, 20)', () => {
    void it('allows Mentor to edit due date of an allocation in their batch (ALC-17)', async () => {
      const mockAlloc = {
        id: 'alloc-1',
        batchId: liveBatch.id,
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-10T00:00:00.000Z'),
      } as CourseAllocation;

      allocationsRepository.findAllocationById = () => Promise.resolve(mockAlloc);
      allocationsRepository.saveAllocation = (a) => Promise.resolve(a);

      const updated = await allocationsService.updateAllocationDates(
        'alloc-1',
        { dueDate: '2026-11-15T00:00:00.000Z' },
        mentorUser,
      );

      assert.equal(
        updated.dueDate.toISOString(),
        new Date('2026-11-15T00:00:00.000Z').toISOString(),
      );
    });

    void it('denies Mentor editing an allocation in a batch not belonging to them (ALC-18)', async () => {
      const mockAlloc = {
        id: 'alloc-other',
        batchId: 'foreign-batch-uuid',
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-10T00:00:00.000Z'),
      } as CourseAllocation;

      allocationsRepository.findAllocationById = () => Promise.resolve(mockAlloc);

      await assert.rejects(
        async () => {
          await allocationsService.updateAllocationDates(
            'alloc-other',
            { dueDate: '2026-11-15T00:00:00.000Z' },
            mentorUser,
          );
        },
        (err: unknown) => {
          assert(err instanceof ForbiddenError);
          assert.match(
            err.message,
            /Mentor cannot manage allocations for a batch where they are not an active member/,
          );
          return true;
        },
      );
    });

    void it('soft revokes allocation setting status to REVOKED while retaining progress (ALC-20)', async () => {
      const mockAlloc = {
        id: 'alloc-revoke',
        batchId: liveBatch.id,
        status: CourseAllocationStatus.IN_PROGRESS,
        progressPercent: 40,
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-10T00:00:00.000Z'),
      } as CourseAllocation;

      allocationsRepository.findAllocationById = () => Promise.resolve(mockAlloc);
      allocationsRepository.saveAllocation = (a) => Promise.resolve(a);

      const revoked = await allocationsService.revokeAllocation('alloc-revoke', adminUser);

      assert.equal(revoked.status, CourseAllocationStatus.REVOKED);
      assert.equal(revoked.progressPercent, 40);
    });
  });

  void describe('Lifecycle Handlers & Batch Triggers (USR-05, BAT-10, BAT-12)', () => {
    void it('closes open allocations as CLOSED_ROLE_CHANGE on mentee role change (USR-05)', async () => {
      let closedUserId = '';
      allocationsRepository.closeAllocationsForRoleChange = (userId: string) => {
        closedUserId = userId;
        return Promise.resolve(1);
      };

      await allocationsService.handleUserRoleChanged({
        userId: 'mentee-promoted',
        newRole: 'MENTOR',
      });

      assert.equal(closedUserId, 'mentee-promoted');
    });

    void it('closes old batch allocations as CLOSED_BATCH_CHANGE and reallocates in new batch (BAT-10)', async () => {
      let closedBatchId = '';
      let closedMenteeId = '';
      allocationsRepository.closeAllocationsForBatchTransfer = (batchId, menteeId) => {
        closedBatchId = batchId;
        closedMenteeId = menteeId;
        return Promise.resolve(1);
      };

      const futureDate = new Date(Date.now() + 86400000 * 10);
      allocationsRepository.findOpenBatchAllocations = () => {
        return Promise.resolve([
          {
            id: 'alloc-existing',
            courseId: activeCourse.id,
            batchId: liveBatch.id,
            dueDate: futureDate,
          } as CourseAllocation,
        ]);
      };

      let createdAllocationsCount = 0;
      allocationsRepository.saveAllocations = (allocs) => {
        createdAllocationsCount = allocs.length;
        return Promise.resolve(allocs);
      };

      await allocationsService.handleBatchMemberTransferred({
        batchId: 'source-batch-id',
        menteeId: 'mentee-transferred',
        newBatchId: liveBatch.id,
        actorId: 'admin-1',
      });

      assert.equal(closedBatchId, 'source-batch-id');
      assert.equal(closedMenteeId, 'mentee-transferred');
      assert.equal(createdAllocationsCount, 1);
    });

    void it('allocates open courses of a Live batch to joining mentee if due date is in future (BAT-12)', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 5);
      allocationsRepository.findOpenBatchAllocations = () => {
        return Promise.resolve([
          {
            id: 'alloc-live-1',
            courseId: activeCourse.id,
            batchId: liveBatch.id,
            dueDate: futureDate,
          } as CourseAllocation,
        ]);
      };

      let createdAllocationsCount = 0;
      allocationsRepository.saveAllocations = (allocs) => {
        createdAllocationsCount = allocs.length;
        return Promise.resolve(allocs);
      };

      await allocationsService.handleBatchMemberJoined({
        batchId: liveBatch.id,
        userId: 'new-mentee-1',
        role: 'MENTEE',
        actorId: 'admin-1',
      });

      assert.equal(createdAllocationsCount, 1);
    });

    void it('does not allocate courses when batch is not LIVE (BAT-12)', async () => {
      let saveCalled = false;
      allocationsRepository.saveAllocations = (allocs) => {
        saveCalled = true;
        return Promise.resolve(allocs);
      };

      await allocationsService.handleBatchMemberJoined({
        batchId: draftBatch.id,
        userId: 'new-mentee-2',
        role: 'MENTEE',
      });

      assert.equal(saveCalled, false);
    });
  });

  void describe('Assignment Due Overrides (FR-7.6)', () => {
    void it('allows setting an assignment due-date override', async () => {
      const mockAlloc = {
        id: 'alloc-1',
        batchId: liveBatch.id,
        courseId: activeCourse.id,
        userId: 'mentee-1',
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-20T00:00:00.000Z'),
      } as CourseAllocation;

      allocationsRepository.findAllocationById = () => Promise.resolve(mockAlloc);
      allocationsRepository.findAssignmentOverride = () => Promise.resolve(null);
      allocationsRepository.saveAssignmentOverride = (override) => Promise.resolve(override);

      const override = await allocationsService.setAssignmentDueOverride(
        'alloc-1',
        {
          assignmentId: 'assign-uuid-1',
          dueDate: '2026-11-25T00:00:00.000Z',
        },
        adminUser,
      );

      assert.equal(override.assignmentId, 'assign-uuid-1');
      assert.equal(
        override.dueDate.toISOString(),
        new Date('2026-11-25T00:00:00.000Z').toISOString(),
      );
    });
  });
});
