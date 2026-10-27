import { In, Repository } from 'typeorm';

import { AppDataSource } from '../../core/db';
import { CourseAllocation, CourseAllocationStatus } from '../allocations';
import { BatchMember, MentorMentee } from '../batches';
import { Assignment, Course } from '../courses';
import { User } from '../users';
import { Submission } from './entities/submission.entity';

export class SubmissionsRepository {
  private get submissionRepo(): Repository<Submission> {
    return AppDataSource.getRepository(Submission);
  }

  private get assignmentRepo(): Repository<Assignment> {
    return AppDataSource.getRepository(Assignment);
  }

  private get userRepo(): Repository<User> {
    return AppDataSource.getRepository(User);
  }

  private get mentorMenteeRepo(): Repository<MentorMentee> {
    return AppDataSource.getRepository(MentorMentee);
  }

  private get batchMemberRepo(): Repository<BatchMember> {
    return AppDataSource.getRepository(BatchMember);
  }

  private get courseRepo(): Repository<Course> {
    return AppDataSource.getRepository(Course);
  }

  private get courseAllocationRepo(): Repository<CourseAllocation> {
    return AppDataSource.getRepository(CourseAllocation);
  }

  async findCourseAllocation(
    userId: string,
    courseId: string,
    requestedAllocationId?: string,
  ): Promise<CourseAllocation | null> {
    if (!AppDataSource.isInitialized) return null;

    if (requestedAllocationId) {
      const byId = await this.courseAllocationRepo.findOne({
        where: { id: requestedAllocationId },
        relations: ['batch', 'assignmentOverrides'],
      });
      if (byId) return byId;
    }

    return this.courseAllocationRepo.findOne({
      where: {
        userId,
        courseId,
        status: In([CourseAllocationStatus.ASSIGNED, CourseAllocationStatus.IN_PROGRESS]),
      },
      relations: ['batch', 'assignmentOverrides'],
    });
  }

  async findOpenCourseAllocationsForMentee(userId: string): Promise<CourseAllocation[]> {
    if (!AppDataSource.isInitialized) return [];

    return this.courseAllocationRepo.find({
      where: {
        userId,
        status: In([CourseAllocationStatus.ASSIGNED, CourseAllocationStatus.IN_PROGRESS]),
      },
      relations: ['batch', 'course', 'assignmentOverrides'],
    });
  }

  async findUserById(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  async findActiveBatchMember(userId: string): Promise<BatchMember | null> {
    return this.batchMemberRepo.findOne({
      where: { userId, isActive: true },
      relations: ['batch'],
    });
  }

  async findActiveCourses(): Promise<Course[]> {
    return this.courseRepo.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findAssignmentsByCourseIds(
    courseIds: string[],
    courseIdFilter?: string,
    topicIdFilter?: string,
  ): Promise<Assignment[]> {
    if (courseIds.length === 0) {
      return [];
    }

    const qb = this.assignmentRepo
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.course', 'course')
      .leftJoinAndSelect('assignment.topic', 'topic')
      .where('assignment.courseId IN (:...courseIds)', { courseIds })
      .andWhere('assignment.deletedAt IS NULL');

    if (courseIdFilter) {
      qb.andWhere('assignment.courseId = :courseIdFilter', { courseIdFilter });
    }

    if (topicIdFilter) {
      qb.andWhere('assignment.topicId = :topicIdFilter', { topicIdFilter });
    }

    qb.orderBy('course.title', 'ASC').addOrderBy('assignment.displayOrder', 'ASC');

    return qb.getMany();
  }

  async findSubmissionsByAllocationsAndAssignments(
    allocationIds: string[],
    assignmentIds: string[],
  ): Promise<Submission[]> {
    if (allocationIds.length === 0 || assignmentIds.length === 0) {
      return [];
    }

    return this.submissionRepo.find({
      where: {
        courseAllocationId: In(allocationIds),
        assignmentId: In(assignmentIds),
      },
      order: { version: 'DESC' },
    });
  }

  async findAssignmentById(assignmentId: string): Promise<Assignment | null> {
    return this.assignmentRepo.findOne({
      where: { id: assignmentId },
      relations: ['course', 'topic'],
    });
  }

  async findSubmissionsForAllocationAndAssignment(
    allocationId: string,
    assignmentId: string,
  ): Promise<Submission[]> {
    return this.submissionRepo.find({
      where: {
        courseAllocationId: allocationId,
        assignmentId,
      },
      order: { version: 'DESC' },
    });
  }

  async findLatestSubmission(
    allocationId: string,
    assignmentId: string,
  ): Promise<Submission | null> {
    return this.submissionRepo.findOne({
      where: {
        courseAllocationId: allocationId,
        assignmentId,
      },
      order: { version: 'DESC' },
    });
  }

  createSubmission(data: Partial<Submission>): Submission {
    const sub = new Submission();
    return Object.assign(sub, data);
  }

  async saveSubmission(submission: Submission): Promise<Submission> {
    return this.submissionRepo.save(submission);
  }

  async findMentorMapping(batchId: string, menteeId: string): Promise<MentorMentee | null> {
    return this.mentorMenteeRepo.findOne({
      where: { batchId, menteeId, isActive: true },
      relations: ['mentor'],
    });
  }
}

export const submissionsRepository = new SubmissionsRepository();
