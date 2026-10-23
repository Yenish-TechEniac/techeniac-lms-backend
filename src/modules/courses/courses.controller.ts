import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import type { AuthenticatedUser } from '../../core/auth';
import { coursesService } from './courses.service';
import type {
  CreateAssignmentInput,
  CreateCourseInput,
  CreateSubtopicInput,
  CreateTopicInput,
  ListCoursesQueryInput,
  ReorderItemsInput,
  StatusToggleInput,
  UpdateAssignmentInput,
  UpdateCourseInput,
  UpdateSubtopicInput,
  UpdateTopicInput,
} from './schemas/courses.schemas';

export class CoursesController {
  // Course Endpoints
  async createCourse(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as CreateCourseInput;
    const course = await coursesService.createCourse(body, user);
    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: { course },
    });
  }

  async getCourseById(req: Request, res: Response): Promise<void> {
    const includeOutline = req.query.outline === 'true';
    const course = await coursesService.getCourseById(String(req.params.id), includeOutline);
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: { course },
    });
  }

  async listCourses(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as ListCoursesQueryInput;
    const { items, total } = await coursesService.listCourses(query);
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        courses: items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });
  }

  async updateCourse(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as UpdateCourseInput;
    const course = await coursesService.updateCourse(String(req.params.id), body, user);
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: { course },
    });
  }

  async toggleCourseStatus(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as StatusToggleInput;
    const course = await coursesService.toggleCourseStatus(
      String(req.params.id),
      body.isActive,
      user,
      body.expectedUpdatedAt,
    );
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: { course },
    });
  }

  async deleteCourse(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    await coursesService.deleteCourse(String(req.params.id), user);
    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Course deleted successfully',
    });
  }

  async cloneCourse(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const cloned = await coursesService.cloneCourse(String(req.params.id), user);
    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: { course: cloned },
    });
  }

  async getCourseImpact(req: Request, res: Response): Promise<void> {
    const impact = await coursesService.getCourseImpact(String(req.params.id));
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: { impact },
    });
  }

  // Topic Endpoints
  async createTopic(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as CreateTopicInput;
    const topic = await coursesService.createTopic(String(req.params.id), body, user);
    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: { topic },
    });
  }

  async updateTopic(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as UpdateTopicInput;
    const topic = await coursesService.updateTopic(String(req.params.id), body, user);
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: { topic },
    });
  }

  async toggleTopicStatus(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as StatusToggleInput;
    const topic = await coursesService.toggleTopicStatus(
      String(req.params.id),
      body.isActive,
      user,
      body.expectedUpdatedAt,
    );
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: { topic },
    });
  }

  async deleteTopic(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    await coursesService.deleteTopic(String(req.params.id), user);
    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Topic deleted successfully',
    });
  }

  async reorderTopics(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as ReorderItemsInput;
    await coursesService.reorderTopics(String(req.params.id), body.items, user);
    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Topics reordered successfully',
    });
  }

  // Subtopic Endpoints
  async createSubtopic(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as CreateSubtopicInput;
    const subtopic = await coursesService.createSubtopic(String(req.params.id), body, user);
    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: { subtopic },
    });
  }

  async updateSubtopic(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as UpdateSubtopicInput;
    const subtopic = await coursesService.updateSubtopic(String(req.params.id), body, user);
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: { subtopic },
    });
  }

  async toggleSubtopicStatus(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as StatusToggleInput;
    const subtopic = await coursesService.toggleSubtopicStatus(
      String(req.params.id),
      body.isActive,
      user,
      body.expectedUpdatedAt,
    );
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: { subtopic },
    });
  }

  async deleteSubtopic(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    await coursesService.deleteSubtopic(String(req.params.id), user);
    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Subtopic deleted successfully',
    });
  }

  async reorderSubtopics(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as ReorderItemsInput;
    await coursesService.reorderSubtopics(String(req.params.id), body.items, user);
    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Subtopics reordered successfully',
    });
  }

  // Assignment Endpoints
  async createAssignment(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as CreateAssignmentInput;
    const assignment = await coursesService.createAssignment(String(req.params.id), body, user);
    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: { assignment },
    });
  }

  async updateAssignment(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as UpdateAssignmentInput;
    const assignment = await coursesService.updateAssignment(String(req.params.id), body, user);
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: { assignment },
    });
  }

  async deleteAssignment(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    await coursesService.deleteAssignment(String(req.params.id), user);
    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Assignment deleted successfully',
    });
  }

  async reorderAssignments(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;
    const body = req.body as ReorderItemsInput;
    await coursesService.reorderAssignments(String(req.params.id), body.items, user);
    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Assignments reordered successfully',
    });
  }
}

export const coursesController = new CoursesController();
