import { In } from 'typeorm';

import { AppDataSource } from '../../core/db';
import { Assignment, AssignmentScope, Course, Subtopic, Topic } from './entities';

export interface CourseImpactInfo {
  courseId: string;
  openAllocationsCount: number;
  affectedMenteesCount: number;
}

export class CoursesRepository {
  private get courseRepo() {
    return AppDataSource.getRepository(Course);
  }

  private get topicRepo() {
    return AppDataSource.getRepository(Topic);
  }

  private get subtopicRepo() {
    return AppDataSource.getRepository(Subtopic);
  }

  private get assignmentRepo() {
    return AppDataSource.getRepository(Assignment);
  }

  // --- Course Operations ---
  async createCourse(data: Partial<Course>): Promise<Course> {
    const course = this.courseRepo.create(data);
    return await this.courseRepo.save(course);
  }

  async findCourseById(id: string, includeFullOutline = false): Promise<Course | null> {
    const course = await this.courseRepo.findOne({
      where: { id },
      relations: ['creator'],
    });

    if (!course || !includeFullOutline) {
      return course;
    }

    const topics = await this.topicRepo.find({
      where: { courseId: id },
      order: { displayOrder: 'ASC' },
    });

    const topicIds = topics.map((t) => t.id);
    const subtopics =
      topicIds.length > 0
        ? await this.subtopicRepo.find({
            where: { topicId: In(topicIds) },
            order: { displayOrder: 'ASC' },
          })
        : [];

    const assignments = await this.assignmentRepo.find({
      where: { courseId: id },
      order: { displayOrder: 'ASC' },
    });

    for (const topic of topics) {
      topic.subtopics = subtopics.filter((s) => s.topicId === topic.id);
      topic.assignments = assignments.filter(
        (a) => a.scope === AssignmentScope.TOPIC && a.topicId === topic.id,
      );
    }

    course.topics = topics;
    course.assignments = assignments.filter((a) => a.scope === AssignmentScope.COURSE);
    course.courseAssignments = course.assignments;

    return course;
  }

  async listCourses(options: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
    sortBy: 'createdAt' | 'title' | 'updatedAt';
    sortOrder: 'asc' | 'desc';
  }): Promise<{ items: Course[]; total: number }> {
    const qb = this.courseRepo
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.creator', 'creator')
      .where('course.deletedAt IS NULL');

    if (options.isActive !== undefined) {
      qb.andWhere('course.isActive = :isActive', { isActive: options.isActive });
    }

    if (options.search) {
      qb.andWhere('(LOWER(course.title) LIKE :search OR LOWER(course.description) LIKE :search)', {
        search: `%${options.search.toLowerCase()}%`,
      });
    }

    const sortColumn =
      options.sortBy === 'title'
        ? 'course.title'
        : options.sortBy === 'updatedAt'
          ? 'course.updatedAt'
          : 'course.createdAt';

    qb.orderBy(sortColumn, options.sortOrder.toUpperCase() as 'ASC' | 'DESC');
    qb.skip((options.page - 1) * options.limit).take(options.limit);

    const [items, total] = await qb.getManyAndCount();

    const courseIds = items.map((c) => c.id);
    if (courseIds.length > 0) {
      const topicCounts = await this.topicRepo
        .createQueryBuilder('topic')
        .select('topic.courseId', 'courseId')
        .addSelect('COUNT(*)', 'count')
        .where('topic.courseId IN (:...courseIds)', { courseIds })
        .andWhere('topic.deletedAt IS NULL')
        .groupBy('topic.courseId')
        .getRawMany<{ courseId: string; count: string }>();

      const assignmentCounts = await this.assignmentRepo
        .createQueryBuilder('assignment')
        .select('assignment.courseId', 'courseId')
        .addSelect('COUNT(*)', 'count')
        .where('assignment.courseId IN (:...courseIds)', { courseIds })
        .andWhere('assignment.deletedAt IS NULL')
        .groupBy('assignment.courseId')
        .getRawMany<{ courseId: string; count: string }>();

      const topicCountMap = new Map(topicCounts.map((t) => [t.courseId, parseInt(t.count, 10)]));
      const assignmentCountMap = new Map(
        assignmentCounts.map((a) => [a.courseId, parseInt(a.count, 10)]),
      );

      for (const item of items) {
        item.topicCount = topicCountMap.get(item.id) ?? 0;
        item.assignmentCount = assignmentCountMap.get(item.id) ?? 0;
      }
    }

    return { items, total };
  }

  async updateCourse(id: string, data: Partial<Course>): Promise<Course | null> {
    await this.courseRepo.update(id, data);
    return await this.courseRepo.findOne({ where: { id } });
  }

  async softDeleteCourse(id: string): Promise<boolean> {
    const res = await this.courseRepo.softDelete(id);
    return (res.affected ?? 0) > 0;
  }

  async getCourseImpact(courseId: string): Promise<CourseImpactInfo> {
    try {
      // Check if course_allocations table exists
      const tableCheck = await AppDataSource.query<Array<{ table_name: string }>>(
        `SELECT table_name FROM information_schema.tables WHERE table_name = 'course_allocations'`,
      );
      if (!tableCheck || tableCheck.length === 0) {
        return { courseId, openAllocationsCount: 0, affectedMenteesCount: 0 };
      }

      const rows = await AppDataSource.query<
        Array<{ alloc_count?: string; mentee_count?: string }>
      >(
        `SELECT COUNT(DISTINCT ca.id) as alloc_count, COUNT(DISTINCT cam.mentee_id) as mentee_count
         FROM course_allocations ca
         LEFT JOIN course_allocation_mentees cam ON cam.allocation_id = ca.id
         WHERE ca.course_id = $1 AND ca.status = 'ACTIVE'`,
        [courseId],
      );

      const allocCount = parseInt(rows[0]?.alloc_count ?? '0', 10);
      const menteeCount = parseInt(rows[0]?.mentee_count ?? '0', 10);
      return {
        courseId,
        openAllocationsCount: allocCount,
        affectedMenteesCount: menteeCount,
      };
    } catch {
      return { courseId, openAllocationsCount: 0, affectedMenteesCount: 0 };
    }
  }

  // --- Topic Operations ---
  async createTopic(data: Partial<Topic>): Promise<Topic> {
    const topic = this.topicRepo.create(data);
    return await this.topicRepo.save(topic);
  }

  async findTopicById(id: string): Promise<Topic | null> {
    const topic = await this.topicRepo.findOne({
      where: { id },
    });

    if (!topic) {
      return null;
    }

    const subtopics = await this.subtopicRepo.find({
      where: { topicId: id },
      order: { displayOrder: 'ASC' },
    });

    const assignments = await this.assignmentRepo.find({
      where: { topicId: id },
      order: { displayOrder: 'ASC' },
    });

    topic.subtopics = subtopics;
    topic.assignments = assignments;

    return topic;
  }

  async updateTopic(id: string, data: Partial<Topic>): Promise<Topic | null> {
    await this.topicRepo.update(id, data);
    return await this.topicRepo.findOne({ where: { id } });
  }

  async deleteTopic(id: string): Promise<boolean> {
    const res = await this.topicRepo.delete(id);
    return (res.affected ?? 0) > 0;
  }

  async getNextTopicOrder(courseId: string): Promise<number> {
    const maxRow = await this.topicRepo
      .createQueryBuilder('topic')
      .select('MAX(topic.displayOrder)', 'max')
      .where('topic.courseId = :courseId', { courseId })
      .getRawOne<{ max?: string | null }>();
    return (
      (maxRow?.max !== null && maxRow?.max !== undefined ? parseInt(String(maxRow.max), 10) : -1) +
      1
    );
  }

  async reorderTopics(items: { id: string; displayOrder: number }[]): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      for (const item of items) {
        await manager.update(Topic, item.id, { displayOrder: item.displayOrder });
      }
    });
  }

  // --- Subtopic Operations ---
  async createSubtopic(data: Partial<Subtopic>): Promise<Subtopic> {
    const subtopic = this.subtopicRepo.create(data);
    return await this.subtopicRepo.save(subtopic);
  }

  async findSubtopicById(id: string): Promise<Subtopic | null> {
    return await this.subtopicRepo.findOne({ where: { id } });
  }

  async updateSubtopic(id: string, data: Partial<Subtopic>): Promise<Subtopic | null> {
    await this.subtopicRepo.update(id, data);
    return await this.subtopicRepo.findOne({ where: { id } });
  }

  async deleteSubtopic(id: string): Promise<boolean> {
    const res = await this.subtopicRepo.delete(id);
    return (res.affected ?? 0) > 0;
  }

  async getNextSubtopicOrder(topicId: string): Promise<number> {
    const maxRow = await this.subtopicRepo
      .createQueryBuilder('subtopic')
      .select('MAX(subtopic.displayOrder)', 'max')
      .where('subtopic.topicId = :topicId', { topicId })
      .getRawOne<{ max?: string | null }>();
    return (
      (maxRow?.max !== null && maxRow?.max !== undefined ? parseInt(String(maxRow.max), 10) : -1) +
      1
    );
  }

  async reorderSubtopics(items: { id: string; displayOrder: number }[]): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      for (const item of items) {
        await manager.update(Subtopic, item.id, { displayOrder: item.displayOrder });
      }
    });
  }

  // --- Assignment Operations ---
  async createAssignment(data: Partial<Assignment>): Promise<Assignment> {
    const assignment = this.assignmentRepo.create(data);
    return await this.assignmentRepo.save(assignment);
  }

  async findAssignmentById(id: string): Promise<Assignment | null> {
    return await this.assignmentRepo.findOne({ where: { id } });
  }

  async updateAssignment(id: string, data: Partial<Assignment>): Promise<Assignment | null> {
    await this.assignmentRepo.update(id, data);
    return await this.assignmentRepo.findOne({ where: { id } });
  }

  async deleteAssignment(id: string): Promise<boolean> {
    const res = await this.assignmentRepo.delete(id);
    return (res.affected ?? 0) > 0;
  }

  async getNextAssignmentOrder(
    courseId: string,
    scope: string,
    topicId?: string | null,
  ): Promise<number> {
    const qb = this.assignmentRepo
      .createQueryBuilder('assignment')
      .select('MAX(assignment.displayOrder)', 'max')
      .where('assignment.courseId = :courseId', { courseId })
      .andWhere('assignment.scope = :scope', { scope });

    if (topicId) {
      qb.andWhere('assignment.topicId = :topicId', { topicId });
    } else {
      qb.andWhere('assignment.topicId IS NULL');
    }

    const maxRow = await qb.getRawOne<{ max?: string | null }>();
    return (
      (maxRow?.max !== null && maxRow?.max !== undefined ? parseInt(String(maxRow.max), 10) : -1) +
      1
    );
  }

  async reorderAssignments(items: { id: string; displayOrder: number }[]): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      for (const item of items) {
        await manager.update(Assignment, item.id, { displayOrder: item.displayOrder });
      }
    });
  }
}

export const coursesRepository = new CoursesRepository();
