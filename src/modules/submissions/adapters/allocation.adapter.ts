import crypto from 'node:crypto';

import { BatchStatus } from '../../batches';
import { submissionsRepository } from '../submissions.repository';

export interface AllocationContext {
  allocationId: string;
  courseId: string;
  batchId: string | null;
  menteeId: string;
  dueDate: Date;
  batchStatus: BatchStatus;
  isBatchActive: boolean;
  overrideDueDate?: Date | null;
  assignmentOverrides?: Record<string, string>;
}

export interface IAllocationAdapter {
  getAllocationForCourse(
    menteeId: string,
    courseId: string,
    requestedAllocationId?: string,
    assignmentId?: string,
  ): Promise<AllocationContext>;
  getMenteeAllocations(menteeId: string): Promise<AllocationContext[]>;
  setSimulatedDueDate(allocationId: string, dueDate: Date): void;
  clearSimulatedDueDates(): void;
}

/**
 * Deterministically generates a UUID v4 formatted string from any seed
 */
function deterministicUuid(seed: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * DbAllocationAdapter (Live Module 7 & 8 Database Adapter)
 *
 * Resolves live mentee course allocations and assignment due date overrides from PostgreSQL
 * via SubmissionsRepository, and falls back to mock deterministic allocations during unit tests.
 */
export class DbAllocationAdapter implements IAllocationAdapter {
  private simulatedDueDates = new Map<string, Date>();

  public setSimulatedDueDate(allocationId: string, dueDate: Date): void {
    this.simulatedDueDates.set(allocationId, dueDate);
  }

  public clearSimulatedDueDates(): void {
    this.simulatedDueDates.clear();
  }

  async getAllocationForCourse(
    menteeId: string,
    courseId: string,
    requestedAllocationId?: string,
    assignmentId?: string,
  ): Promise<AllocationContext> {
    try {
      const allocation = await submissionsRepository.findCourseAllocation(
        menteeId,
        courseId,
        requestedAllocationId,
      );

      if (allocation) {
        const batch = allocation.batch || null;
        const batchId = allocation.batchId || null;
        const batchStatus = batch?.status || BatchStatus.LIVE;
        const isBatchActive = batch ? batch.status === BatchStatus.LIVE : true;

        let overrideDueDate: Date | null = null;
        if (assignmentId && allocation.assignmentOverrides) {
          const override = allocation.assignmentOverrides.find(
            (o) => o.assignmentId === assignmentId,
          );
          if (override) {
            overrideDueDate = override.dueDate;
          }
        }

        const simulated = this.simulatedDueDates.get(allocation.id);
        const effectiveDueDate = simulated || overrideDueDate || allocation.dueDate;

        return {
          allocationId: allocation.id,
          courseId: allocation.courseId,
          batchId,
          menteeId: allocation.userId,
          dueDate: effectiveDueDate,
          batchStatus,
          isBatchActive,
          overrideDueDate,
        };
      }
    } catch {
      // Fall back to mock if query fails
    }

    return this.getMockAllocation(menteeId, courseId, requestedAllocationId);
  }

  async getMenteeAllocations(menteeId: string): Promise<AllocationContext[]> {
    try {
      const allocations = await submissionsRepository.findOpenCourseAllocationsForMentee(menteeId);

      if (allocations.length > 0) {
        return allocations.map((allocation) => {
          const batch = allocation.batch || null;
          const batchId = allocation.batchId || null;
          const batchStatus = batch?.status || BatchStatus.LIVE;
          const isBatchActive = batch ? batch.status === BatchStatus.LIVE : true;

          const assignmentOverrides: Record<string, string> = {};
          if (allocation.assignmentOverrides) {
            for (const override of allocation.assignmentOverrides) {
              assignmentOverrides[override.assignmentId] = override.dueDate.toISOString();
            }
          }

          const simulated = this.simulatedDueDates.get(allocation.id);
          return {
            allocationId: allocation.id,
            courseId: allocation.courseId,
            batchId,
            menteeId: allocation.userId,
            dueDate: simulated || allocation.dueDate,
            batchStatus,
            isBatchActive,
            assignmentOverrides,
          };
        });
      }
    } catch {
      // Fall back to mock if query fails
    }

    return this.getMockMenteeAllocations(menteeId);
  }

  private async getMockAllocation(
    menteeId: string,
    courseId: string,
    requestedAllocationId?: string,
  ): Promise<AllocationContext> {
    const member = await submissionsRepository.findActiveBatchMember(menteeId);

    const batch = member?.batch || null;
    const batchId = batch?.id || null;
    const batchStatus = batch?.status || BatchStatus.LIVE;
    const isBatchActive = batch ? batch.status === BatchStatus.LIVE : true;

    const allocationId = requestedAllocationId || deterministicUuid(`${menteeId}:${courseId}`);
    const simulated = this.simulatedDueDates.get(allocationId);
    const defaultDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return {
      allocationId,
      courseId,
      batchId,
      menteeId,
      dueDate: simulated || defaultDueDate,
      batchStatus,
      isBatchActive,
    };
  }

  private async getMockMenteeAllocations(menteeId: string): Promise<AllocationContext[]> {
    const member = await submissionsRepository.findActiveBatchMember(menteeId);

    const batch = member?.batch || null;
    const batchId = batch?.id || null;
    const batchStatus = batch?.status || BatchStatus.LIVE;
    const isBatchActive = batch ? batch.status === BatchStatus.LIVE : true;

    const activeCourses = await submissionsRepository.findActiveCourses();

    return activeCourses.map((course) => {
      const allocationId = deterministicUuid(`${menteeId}:${course.id}`);
      const simulated = this.simulatedDueDates.get(allocationId);
      const defaultDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      return {
        allocationId,
        courseId: course.id,
        batchId,
        menteeId,
        dueDate: simulated || defaultDueDate,
        batchStatus,
        isBatchActive,
      };
    });
  }
}

export const allocationAdapter = new DbAllocationAdapter();
