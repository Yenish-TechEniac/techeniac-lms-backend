import { EntityManager, In, IsNull } from 'typeorm';

import { AppDataSource } from '../../core/db';
import { CourseAllocation, CourseAllocationStatus } from '../allocations';
import { Topic } from '../courses';
import { TopicProgress, TopicProgressStatus } from './entities';

export class ProgressRepository {
  private get repo() {
    return AppDataSource.getRepository(TopicProgress);
  }

  private get topicRepo() {
    return AppDataSource.getRepository(Topic);
  }

  private get allocationRepo() {
    return AppDataSource.getRepository(CourseAllocation);
  }

  async findActiveTopicsByCourseId(courseId: string): Promise<Topic[]> {
    return await this.topicRepo.find({
      where: {
        courseId,
        isActive: true,
        deletedAt: IsNull(),
      },
      order: {
        displayOrder: 'ASC',
      },
    });
  }

  async findTopicById(topicId: string): Promise<Topic | null> {
    return await this.topicRepo.findOne({
      where: { id: topicId, deletedAt: IsNull() },
    });
  }

  async initializeTopicProgressForAllocations(
    allocationIds: string[],
    topicIds: string[],
    manager?: EntityManager,
  ): Promise<void> {
    if (allocationIds.length === 0 || topicIds.length === 0) {
      return;
    }

    const rows: Array<{
      courseAllocationId: string;
      topicId: string;
      status: TopicProgressStatus;
    }> = [];

    for (const allocId of allocationIds) {
      for (const topicId of topicIds) {
        rows.push({
          courseAllocationId: allocId,
          topicId: topicId,
          status: TopicProgressStatus.NOT_STARTED,
        });
      }
    }

    const qb = (manager ?? AppDataSource).createQueryBuilder();
    await qb
      .insert()
      .into(TopicProgress)
      .values(rows)
      .orIgnore() // Idempotent: ignore existing (course_allocation_id, topic_id)
      .execute();
  }

  async findByAllocationAndTopic(
    courseAllocationId: string,
    topicId: string,
  ): Promise<TopicProgress | null> {
    return await this.repo.findOne({
      where: {
        courseAllocationId,
        topicId,
        deletedAt: IsNull(),
      },
      relations: ['topic'],
    });
  }

  async listByAllocationId(courseAllocationId: string): Promise<TopicProgress[]> {
    return await this.repo
      .createQueryBuilder('tp')
      .leftJoinAndSelect('tp.topic', 'topic')
      .where('tp.courseAllocationId = :courseAllocationId', { courseAllocationId })
      .andWhere('tp.deletedAt IS NULL')
      .orderBy('topic.displayOrder', 'ASC')
      .getMany();
  }

  async findAllocationById(allocationId: string): Promise<CourseAllocation | null> {
    return await this.allocationRepo.findOne({
      where: { id: allocationId, deletedAt: IsNull() },
      relations: ['batch', 'course', 'user'],
    });
  }

  async findOpenAllocationsByCourseId(courseId: string): Promise<CourseAllocation[]> {
    return await this.allocationRepo.find({
      where: {
        courseId,
        status: In([CourseAllocationStatus.ASSIGNED, CourseAllocationStatus.IN_PROGRESS]),
        deletedAt: IsNull(),
      },
    });
  }

  async listTrackers(options: {
    batchId?: string;
    menteeId?: string;
    courseId?: string;
    batchIds?: string[];
  }): Promise<CourseAllocation[]> {
    const qb = this.allocationRepo
      .createQueryBuilder('alloc')
      .leftJoinAndSelect('alloc.user', 'user')
      .leftJoinAndSelect('alloc.course', 'course')
      .leftJoinAndSelect('alloc.batch', 'batch')
      .where('alloc.deletedAt IS NULL');

    if (options.batchId) {
      qb.andWhere('alloc.batchId = :batchId', { batchId: options.batchId });
    } else if (options.batchIds && options.batchIds.length > 0) {
      qb.andWhere('alloc.batchId IN (:...batchIds)', { batchIds: options.batchIds });
    }

    if (options.menteeId) {
      qb.andWhere('alloc.userId = :menteeId', { menteeId: options.menteeId });
    }

    if (options.courseId) {
      qb.andWhere('alloc.courseId = :courseId', { courseId: options.courseId });
    }

    return await qb.orderBy('alloc.createdAt', 'DESC').getMany();
  }

  async updateAllocationProgress(
    allocationId: string,
    updates: {
      progressPercent: number;
      status?: CourseAllocationStatus;
      completedAt?: Date | null;
    },
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(CourseAllocation) : this.allocationRepo;
    await repo.update({ id: allocationId, deletedAt: IsNull() }, updates);
  }

  async save(progress: TopicProgress, manager?: EntityManager): Promise<TopicProgress> {
    const repo = manager ? manager.getRepository(TopicProgress) : this.repo;
    return await repo.save(progress);
  }
}

export const progressRepository = new ProgressRepository();
