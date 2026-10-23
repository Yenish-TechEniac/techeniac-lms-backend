import type { AuthenticatedUser } from '../../core/auth';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors';
import { eventBus } from '../../core/lifecycle';
import { sanitizeHtml } from '../../core/utils/sanitizer';
import { coursesRepository } from './courses.repository';
import {
  Assignment,
  AssignmentScope,
  Course,
  type ResourceItem,
  SubmissionMode,
  Subtopic,
  Topic,
} from './entities';

export class CoursesService {
  // Permission helper (CRS-18)
  private assertCanEdit(course: Course, user: AuthenticatedUser): void {
    if (user.role === 'SUPER_ADMIN') {
      return;
    }
    if (user.role === 'MENTOR' && course.createdBy === user.id) {
      return;
    }
    throw new ForbiddenError('You do not have permission to modify this course');
  }

  // Concurrency helper (FR-6.13, CRS-19)
  private assertNotStale(actualUpdatedAt: Date, expectedUpdatedAt?: string): void {
    if (!expectedUpdatedAt) {
      return;
    }
    const expectedTime = new Date(expectedUpdatedAt).getTime();
    const actualTime = actualUpdatedAt.getTime();
    if (isNaN(expectedTime) || actualTime !== expectedTime) {
      throw new ConflictError(
        'This item was modified concurrently by another user. Please reload the latest changes.',
      );
    }
  }

  // --- Course Service Methods ---
  async createCourse(
    data: {
      title: string;
      description?: string;
      estimatedMinutes?: number;
      isActive?: boolean;
    },
    user: AuthenticatedUser,
  ): Promise<Course> {
    return await coursesRepository.createCourse({
      ...data,
      createdBy: user.id,
      isActive: data.isActive ?? true,
    });
  }

  async getCourseById(id: string, includeFullOutline = false): Promise<Course> {
    const course = await coursesRepository.findCourseById(id, includeFullOutline);
    if (!course) {
      throw new NotFoundError('Course not found');
    }
    return course;
  }

  async listCourses(options: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
    sortBy: 'createdAt' | 'title' | 'updatedAt';
    sortOrder: 'asc' | 'desc';
  }) {
    return await coursesRepository.listCourses(options);
  }

  async updateCourse(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      estimatedMinutes?: number | null;
      isActive?: boolean;
      expectedUpdatedAt?: string;
    },
    user: AuthenticatedUser,
  ): Promise<Course> {
    const course = await this.getCourseById(id, true);
    this.assertCanEdit(course, user);
    this.assertNotStale(course.updatedAt, data.expectedUpdatedAt);

    if (data.estimatedMinutes !== undefined && data.estimatedMinutes !== null) {
      const topicsSum = course.topics?.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0) || 0;
      if (data.estimatedMinutes < topicsSum) {
        throw new ValidationError(
          `Course duration (${Math.floor(data.estimatedMinutes / 60)}h ${data.estimatedMinutes % 60}m) cannot be less than the total allocated duration of its topics (${Math.floor(topicsSum / 60)}h ${topicsSum % 60}m).`,
        );
      }
    }

    const updatePayload: Partial<Course> = {
      updatedBy: user.id,
    };
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.estimatedMinutes !== undefined) updatePayload.estimatedMinutes = data.estimatedMinutes;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

    const updated = await coursesRepository.updateCourse(id, updatePayload);
    if (!updated) {
      throw new NotFoundError('Course not found');
    }
    return updated;
  }

  async toggleCourseStatus(
    id: string,
    isActive: boolean,
    user: AuthenticatedUser,
    expectedUpdatedAt?: string,
  ): Promise<Course> {
    const course = await this.getCourseById(id);
    this.assertCanEdit(course, user);
    this.assertNotStale(course.updatedAt, expectedUpdatedAt);

    const updated = await coursesRepository.updateCourse(id, {
      isActive,
      updatedBy: user.id,
    });
    return updated!;
  }

  async deleteCourse(id: string, user: AuthenticatedUser): Promise<void> {
    const course = await this.getCourseById(id);
    this.assertCanEdit(course, user);

    const impact = await coursesRepository.getCourseImpact(id);
    if (impact.openAllocationsCount > 0) {
      throw new ValidationError(
        'Cannot delete a course with active allocations. Deactivate the course instead.',
      );
    }

    await coursesRepository.softDeleteCourse(id);
  }

  async cloneCourse(id: string, user: AuthenticatedUser): Promise<Course> {
    const source = await this.getCourseById(id, true);

    // Create inactive copy (FR-6.7, CRS-21)
    const clonedCourse = await coursesRepository.createCourse({
      title: `${source.title} (Copy)`.slice(0, 150),
      description: source.description,
      estimatedMinutes: source.estimatedMinutes,
      isActive: false,
      createdBy: user.id,
    });

    // Clone topics and their subtopics & assignments
    if (source.topics && source.topics.length > 0) {
      for (const t of source.topics) {
        const clonedTopic = await coursesRepository.createTopic({
          courseId: clonedCourse.id,
          title: t.title,
          description: t.description,
          resources: t.resources,
          displayOrder: t.displayOrder,
          isActive: t.isActive,
          estimatedMinutes: t.estimatedMinutes,
          createdBy: user.id,
        });

        if (t.subtopics && t.subtopics.length > 0) {
          for (const st of t.subtopics) {
            await coursesRepository.createSubtopic({
              topicId: clonedTopic.id,
              title: st.title,
              content: st.content,
              resources: st.resources,
              displayOrder: st.displayOrder,
              isActive: st.isActive,
              estimatedMinutes: st.estimatedMinutes,
              createdBy: user.id,
            });
          }
        }

        if (t.assignments && t.assignments.length > 0) {
          for (const a of t.assignments) {
            await coursesRepository.createAssignment({
              courseId: clonedCourse.id,
              topicId: clonedTopic.id,
              scope: a.scope,
              displayOrder: a.displayOrder,
              title: a.title,
              instructions: a.instructions,
              estimatedMinutes: a.estimatedMinutes,
              maxMarks: a.maxMarks,
              passMarks: a.passMarks,
              allowLate: a.allowLate,
              pdfMode: a.pdfMode,
              zipMode: a.zipMode,
              urlMode: a.urlMode,
              resources: a.resources,
              createdBy: user.id,
            });
          }
        }
      }
    }

    // Clone course-level assignments
    if (source.assignments && source.assignments.length > 0) {
      const courseAssignments = source.assignments.filter(
        (a) => a.scope === AssignmentScope.COURSE,
      );
      for (const a of courseAssignments) {
        await coursesRepository.createAssignment({
          courseId: clonedCourse.id,
          topicId: null,
          scope: AssignmentScope.COURSE,
          displayOrder: a.displayOrder,
          title: a.title,
          instructions: a.instructions,
          estimatedMinutes: a.estimatedMinutes,
          maxMarks: a.maxMarks,
          passMarks: a.passMarks,
          allowLate: a.allowLate,
          pdfMode: a.pdfMode,
          zipMode: a.zipMode,
          urlMode: a.urlMode,
          resources: a.resources,
          createdBy: user.id,
        });
      }
    }

    return clonedCourse;
  }

  async getCourseImpact(id: string) {
    await this.getCourseById(id);
    return await coursesRepository.getCourseImpact(id);
  }

  // --- Topic Service Methods ---
  async createTopic(
    courseId: string,
    data: {
      title: string;
      description?: string;
      resources?: ResourceItem[];
      displayOrder?: number;
      estimatedMinutes?: number;
      isActive?: boolean;
    },
    user: AuthenticatedUser,
  ): Promise<Topic> {
    const course = await this.getCourseById(courseId, true);
    this.assertCanEdit(course, user);

    if (
      course.estimatedMinutes !== null &&
      course.estimatedMinutes !== undefined &&
      course.estimatedMinutes > 0 &&
      data.estimatedMinutes !== undefined &&
      data.estimatedMinutes !== null
    ) {
      const otherTopicsSum =
        course.topics?.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0) || 0;
      const remainingBudget = course.estimatedMinutes - otherTopicsSum;
      if (data.estimatedMinutes > remainingBudget) {
        throw new ValidationError(
          `Topic duration (${Math.floor(data.estimatedMinutes / 60)}h ${data.estimatedMinutes % 60}m) exceeds the course's remaining duration budget (${Math.max(0, Math.floor(remainingBudget / 60))}h ${Math.max(0, remainingBudget % 60)}m remaining out of ${Math.floor(course.estimatedMinutes / 60)}h ${course.estimatedMinutes % 60}m total).`,
        );
      }
    }

    const displayOrder =
      data.displayOrder !== undefined
        ? data.displayOrder
        : await coursesRepository.getNextTopicOrder(courseId);

    const topic = await coursesRepository.createTopic({
      courseId,
      title: data.title,
      description: data.description,
      resources: data.resources,
      displayOrder,
      isActive: data.isActive ?? true,
      estimatedMinutes: data.estimatedMinutes,
      createdBy: user.id,
    });

    // Emit FR-6.15 lifecycle event
    eventBus.emitEvent('course.topicsChanged', {
      courseId,
      topicId: topic.id,
      action: 'ADDED',
    });

    return topic;
  }

  async updateTopic(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      resources?: ResourceItem[] | null;
      displayOrder?: number;
      estimatedMinutes?: number | null;
      isActive?: boolean;
      expectedUpdatedAt?: string;
    },
    user: AuthenticatedUser,
  ): Promise<Topic> {
    const topic = await coursesRepository.findTopicById(id);
    if (!topic) {
      throw new NotFoundError('Topic not found');
    }
    const course = await this.getCourseById(topic.courseId, true);
    this.assertCanEdit(course, user);
    this.assertNotStale(topic.updatedAt, data.expectedUpdatedAt);

    if (data.estimatedMinutes !== undefined && data.estimatedMinutes !== null) {
      // 1. Check parent course budget ceiling (if course has estimatedMinutes)
      if (
        course.estimatedMinutes !== null &&
        course.estimatedMinutes !== undefined &&
        course.estimatedMinutes > 0
      ) {
        const otherTopicsSum =
          course.topics
            ?.filter((t) => t.id !== id)
            .reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0) || 0;
        const remainingBudget = course.estimatedMinutes - otherTopicsSum;
        if (data.estimatedMinutes > remainingBudget) {
          throw new ValidationError(
            `Topic duration (${Math.floor(data.estimatedMinutes / 60)}h ${data.estimatedMinutes % 60}m) exceeds the course's remaining duration budget (${Math.max(0, Math.floor(remainingBudget / 60))}h ${Math.max(0, remainingBudget % 60)}m remaining out of ${Math.floor(course.estimatedMinutes / 60)}h ${course.estimatedMinutes % 60}m total).`,
          );
        }
      }

      // 2. Check subtopics floor
      const subtopicsSum =
        topic.subtopics?.reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0) || 0;
      if (data.estimatedMinutes < subtopicsSum) {
        throw new ValidationError(
          `Topic duration (${Math.floor(data.estimatedMinutes / 60)}h ${data.estimatedMinutes % 60}m) cannot be less than the total allocated duration of its subtopics (${Math.floor(subtopicsSum / 60)}h ${subtopicsSum % 60}m).`,
        );
      }
    }

    const updatePayload: Partial<Topic> = { updatedBy: user.id };
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.resources !== undefined) updatePayload.resources = data.resources;
    if (data.displayOrder !== undefined) updatePayload.displayOrder = data.displayOrder;
    if (data.estimatedMinutes !== undefined) updatePayload.estimatedMinutes = data.estimatedMinutes;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

    const updated = await coursesRepository.updateTopic(id, updatePayload);
    return updated!;
  }

  async toggleTopicStatus(
    id: string,
    isActive: boolean,
    user: AuthenticatedUser,
    expectedUpdatedAt?: string,
  ): Promise<Topic> {
    const topic = await coursesRepository.findTopicById(id);
    if (!topic) {
      throw new NotFoundError('Topic not found');
    }
    const course = await this.getCourseById(topic.courseId);
    this.assertCanEdit(course, user);
    this.assertNotStale(topic.updatedAt, expectedUpdatedAt);

    const updated = await coursesRepository.updateTopic(id, {
      isActive,
      updatedBy: user.id,
    });

    // Emit FR-6.15 lifecycle event
    eventBus.emitEvent('course.topicsChanged', {
      courseId: topic.courseId,
      topicId: topic.id,
      action: isActive ? 'REACTIVATED' : 'DEACTIVATED',
    });

    return updated!;
  }

  async deleteTopic(id: string, user: AuthenticatedUser): Promise<void> {
    const topic = await coursesRepository.findTopicById(id);
    if (!topic) {
      throw new NotFoundError('Topic not found');
    }
    const course = await this.getCourseById(topic.courseId);
    this.assertCanEdit(course, user);

    await coursesRepository.deleteTopic(id);

    // Emit FR-6.15 lifecycle event
    eventBus.emitEvent('course.topicsChanged', {
      courseId: topic.courseId,
      topicId: id,
      action: 'DELETED',
    });
  }

  async reorderTopics(
    courseId: string,
    items: { id: string; displayOrder: number }[],
    user: AuthenticatedUser,
  ): Promise<void> {
    const course = await this.getCourseById(courseId);
    this.assertCanEdit(course, user);
    await coursesRepository.reorderTopics(items);
  }

  // --- Subtopic Service Methods ---
  async createSubtopic(
    topicId: string,
    data: {
      title: string;
      content?: string;
      resources?: ResourceItem[];
      displayOrder?: number;
      estimatedMinutes?: number;
      isActive?: boolean;
    },
    user: AuthenticatedUser,
  ): Promise<Subtopic> {
    const topic = await coursesRepository.findTopicById(topicId);
    if (!topic) {
      throw new NotFoundError('Topic not found');
    }
    const course = await this.getCourseById(topic.courseId);
    this.assertCanEdit(course, user);

    if (
      topic.estimatedMinutes !== null &&
      topic.estimatedMinutes !== undefined &&
      topic.estimatedMinutes > 0 &&
      data.estimatedMinutes !== undefined &&
      data.estimatedMinutes !== null
    ) {
      const otherSubtopicsSum =
        topic.subtopics?.reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0) || 0;
      const remainingBudget = topic.estimatedMinutes - otherSubtopicsSum;
      if (data.estimatedMinutes > remainingBudget) {
        throw new ValidationError(
          `Subtopic duration (${Math.floor(data.estimatedMinutes / 60)}h ${data.estimatedMinutes % 60}m) exceeds topic "${topic.title}" remaining duration budget (${Math.max(0, Math.floor(remainingBudget / 60))}h ${Math.max(0, remainingBudget % 60)}m remaining out of ${Math.floor(topic.estimatedMinutes / 60)}h ${topic.estimatedMinutes % 60}m total).`,
        );
      }
    }

    const displayOrder =
      data.displayOrder !== undefined
        ? data.displayOrder
        : await coursesRepository.getNextSubtopicOrder(topicId);

    // Sanitize rich-text content (CRS-23)
    const sanitizedContent = data.content ? sanitizeHtml(data.content) : null;

    return await coursesRepository.createSubtopic({
      topicId,
      title: data.title,
      content: sanitizedContent,
      resources: data.resources ?? null,
      displayOrder,
      isActive: data.isActive ?? true,
      estimatedMinutes: data.estimatedMinutes,
      createdBy: user.id,
    });
  }

  async updateSubtopic(
    id: string,
    data: {
      title?: string;
      content?: string | null;
      resources?: ResourceItem[] | null;
      displayOrder?: number;
      estimatedMinutes?: number | null;
      isActive?: boolean;
      expectedUpdatedAt?: string;
    },
    user: AuthenticatedUser,
  ): Promise<Subtopic> {
    const subtopic = await coursesRepository.findSubtopicById(id);
    if (!subtopic) {
      throw new NotFoundError('Subtopic not found');
    }
    const topic = await coursesRepository.findTopicById(subtopic.topicId);
    if (!topic) {
      throw new NotFoundError('Topic not found');
    }
    const course = await this.getCourseById(topic.courseId);
    this.assertCanEdit(course, user);
    this.assertNotStale(subtopic.updatedAt, data.expectedUpdatedAt);

    if (data.estimatedMinutes !== undefined && data.estimatedMinutes !== null) {
      if (
        topic.estimatedMinutes !== null &&
        topic.estimatedMinutes !== undefined &&
        topic.estimatedMinutes > 0
      ) {
        const otherSubtopicsSum =
          topic.subtopics
            ?.filter((s) => s.id !== id)
            .reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0) || 0;
        const remainingBudget = topic.estimatedMinutes - otherSubtopicsSum;
        if (data.estimatedMinutes > remainingBudget) {
          throw new ValidationError(
            `Subtopic duration (${Math.floor(data.estimatedMinutes / 60)}h ${data.estimatedMinutes % 60}m) exceeds topic "${topic.title}" remaining duration budget (${Math.max(0, Math.floor(remainingBudget / 60))}h ${Math.max(0, remainingBudget % 60)}m remaining out of ${Math.floor(topic.estimatedMinutes / 60)}h ${topic.estimatedMinutes % 60}m total).`,
          );
        }
      }
    }

    const updatePayload: Partial<Subtopic> = { updatedBy: user.id };
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.content !== undefined) {
      updatePayload.content = data.content ? sanitizeHtml(data.content) : null;
    }
    if (data.resources !== undefined) updatePayload.resources = data.resources;
    if (data.displayOrder !== undefined) updatePayload.displayOrder = data.displayOrder;
    if (data.estimatedMinutes !== undefined) updatePayload.estimatedMinutes = data.estimatedMinutes;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

    const updated = await coursesRepository.updateSubtopic(id, updatePayload);
    return updated!;
  }

  async toggleSubtopicStatus(
    id: string,
    isActive: boolean,
    user: AuthenticatedUser,
    expectedUpdatedAt?: string,
  ): Promise<Subtopic> {
    const subtopic = await coursesRepository.findSubtopicById(id);
    if (!subtopic) {
      throw new NotFoundError('Subtopic not found');
    }
    const topic = await coursesRepository.findTopicById(subtopic.topicId);
    const course = await this.getCourseById(topic!.courseId);
    this.assertCanEdit(course, user);
    this.assertNotStale(subtopic.updatedAt, expectedUpdatedAt);

    const updated = await coursesRepository.updateSubtopic(id, {
      isActive,
      updatedBy: user.id,
    });
    return updated!;
  }

  async deleteSubtopic(id: string, user: AuthenticatedUser): Promise<void> {
    const subtopic = await coursesRepository.findSubtopicById(id);
    if (!subtopic) {
      throw new NotFoundError('Subtopic not found');
    }
    const topic = await coursesRepository.findTopicById(subtopic.topicId);
    const course = await this.getCourseById(topic!.courseId);
    this.assertCanEdit(course, user);

    await coursesRepository.deleteSubtopic(id);
  }

  async reorderSubtopics(
    topicId: string,
    items: { id: string; displayOrder: number }[],
    user: AuthenticatedUser,
  ): Promise<void> {
    const topic = await coursesRepository.findTopicById(topicId);
    if (!topic) {
      throw new NotFoundError('Topic not found');
    }
    const course = await this.getCourseById(topic.courseId);
    this.assertCanEdit(course, user);
    await coursesRepository.reorderSubtopics(items);
  }

  // --- Assignment Service Methods ---
  async createAssignment(
    courseId: string,
    data: {
      scope: AssignmentScope;
      topicId?: string | null;
      title: string;
      instructions?: string;
      estimatedMinutes: number;
      maxMarks: number;
      passMarks: number;
      allowLate?: boolean;
      pdfMode: SubmissionMode;
      zipMode: SubmissionMode;
      urlMode: SubmissionMode;
      resources?: ResourceItem[];
      displayOrder?: number;
    },
    user: AuthenticatedUser,
  ): Promise<Assignment> {
    const course = await this.getCourseById(courseId);
    this.assertCanEdit(course, user);

    if (data.scope === AssignmentScope.TOPIC && data.topicId) {
      const topic = await coursesRepository.findTopicById(data.topicId);
      if (!topic || topic.courseId !== courseId) {
        throw new ValidationError('Specified topic does not belong to this course');
      }
    }

    const displayOrder =
      data.displayOrder !== undefined
        ? data.displayOrder
        : await coursesRepository.getNextAssignmentOrder(courseId, data.scope, data.topicId);

    // Sanitize instructions
    const sanitizedInstructions = data.instructions ? sanitizeHtml(data.instructions) : null;

    return await coursesRepository.createAssignment({
      courseId,
      topicId: data.scope === AssignmentScope.TOPIC ? data.topicId : null,
      scope: data.scope,
      displayOrder,
      title: data.title,
      instructions: sanitizedInstructions,
      estimatedMinutes: data.estimatedMinutes,
      maxMarks: data.maxMarks,
      passMarks: data.passMarks,
      allowLate: data.allowLate ?? false,
      pdfMode: data.pdfMode,
      zipMode: data.zipMode,
      urlMode: data.urlMode,
      resources: data.resources ?? null,
      createdBy: user.id,
    });
  }

  async updateAssignment(
    id: string,
    data: {
      title?: string;
      instructions?: string | null;
      estimatedMinutes?: number;
      maxMarks?: number;
      passMarks?: number;
      allowLate?: boolean;
      pdfMode?: SubmissionMode;
      zipMode?: SubmissionMode;
      urlMode?: SubmissionMode;
      resources?: ResourceItem[] | null;
      displayOrder?: number;
      expectedUpdatedAt?: string;
    },
    user: AuthenticatedUser,
  ): Promise<Assignment> {
    const assignment = await coursesRepository.findAssignmentById(id);
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }
    const course = await this.getCourseById(assignment.courseId);
    this.assertCanEdit(course, user);
    this.assertNotStale(assignment.updatedAt, data.expectedUpdatedAt);

    const updatePayload: Partial<Assignment> = { updatedBy: user.id };
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.instructions !== undefined) {
      updatePayload.instructions = data.instructions ? sanitizeHtml(data.instructions) : null;
    }
    if (data.estimatedMinutes !== undefined) updatePayload.estimatedMinutes = data.estimatedMinutes;
    if (data.maxMarks !== undefined) updatePayload.maxMarks = data.maxMarks;
    if (data.passMarks !== undefined) updatePayload.passMarks = data.passMarks;
    if (data.allowLate !== undefined) updatePayload.allowLate = data.allowLate;
    if (data.pdfMode !== undefined) updatePayload.pdfMode = data.pdfMode;
    if (data.zipMode !== undefined) updatePayload.zipMode = data.zipMode;
    if (data.urlMode !== undefined) updatePayload.urlMode = data.urlMode;
    if (data.resources !== undefined) updatePayload.resources = data.resources;
    if (data.displayOrder !== undefined) updatePayload.displayOrder = data.displayOrder;

    const updated = await coursesRepository.updateAssignment(id, updatePayload);
    return updated!;
  }

  async deleteAssignment(id: string, user: AuthenticatedUser): Promise<void> {
    const assignment = await coursesRepository.findAssignmentById(id);
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }
    const course = await this.getCourseById(assignment.courseId);
    this.assertCanEdit(course, user);

    await coursesRepository.deleteAssignment(id);
  }

  async reorderAssignments(
    courseId: string,
    items: { id: string; displayOrder: number }[],
    user: AuthenticatedUser,
  ): Promise<void> {
    const course = await this.getCourseById(courseId);
    this.assertCanEdit(course, user);
    await coursesRepository.reorderAssignments(items);
  }
}

export const coursesService = new CoursesService();
