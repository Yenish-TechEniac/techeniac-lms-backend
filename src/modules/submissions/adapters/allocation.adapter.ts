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
}

export interface IAllocationAdapter {
  getAllocationForCourse(
    menteeId: string,
    courseId: string,
    requestedAllocationId?: string,
  ): Promise<AllocationContext>;
  getMenteeAllocations(menteeId: string): Promise<AllocationContext[]>;
  setSimulatedDueDate(allocationId: string, dueDate: Date): void;
}

/**
 * Deterministically generates a UUID v4 formatted string from any seed
 */
function deterministicUuid(seed: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * MockAllocationAdapter (Active for Phase 1/Module 9)
 *
 * Bridges the gap while Module 7 (Hetvi's course_allocations) and Module 8 (Kaustav's topic_progress)
 * are being completed in parallel. Resolves mentee batch memberships and courses, providing deterministic
 * allocation IDs and configurable due dates for late policy testing.
 *
 * NOTE: Once Module 7 is pulled, swap this with DbAllocationAdapter querying CourseAllocation.
 */
export class MockAllocationAdapter implements IAllocationAdapter {
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
  ): Promise<AllocationContext> {
    const member = await submissionsRepository.findActiveBatchMember(menteeId);

    const batch = member?.batch || null;
    const batchId = batch?.id || null;
    const batchStatus = batch?.status || BatchStatus.LIVE;
    const isBatchActive = batch ? batch.status === BatchStatus.LIVE : true;

    const allocationId = requestedAllocationId || deterministicUuid(`${menteeId}:${courseId}`);

    // Check if a simulated due date exists (useful for testing late submission scenarios)
    const simulated = this.simulatedDueDates.get(allocationId);
    const defaultDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

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

  async getMenteeAllocations(menteeId: string): Promise<AllocationContext[]> {
    const member = await submissionsRepository.findActiveBatchMember(menteeId);

    const batch = member?.batch || null;
    const batchId = batch?.id || null;
    const batchStatus = batch?.status || BatchStatus.LIVE;
    const isBatchActive = batch ? batch.status === BatchStatus.LIVE : true;

    // In mock mode, all active courses are considered accessible to the mentee
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

export const allocationAdapter = new MockAllocationAdapter();
