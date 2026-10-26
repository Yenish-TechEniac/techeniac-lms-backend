import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import type { AuthenticatedUser } from '../../core/auth';
import { UnauthorizedError } from '../../core/errors';
import { BaseController } from '../../core/http';
import { CoursesService, coursesService } from './courses.service';
import type { Course } from './entities';
import {
  type CreateAssignmentInput,
  type CreateCourseInput,
  type CreateSubtopicInput,
  type CreateTopicInput,
  listCoursesQuerySchema,
  type ReorderItemsInput,
  type StatusToggleInput,
  type UpdateAssignmentInput,
  type UpdateCourseInput,
  type UpdateSubtopicInput,
  type UpdateTopicInput,
} from './schemas/courses.schemas';

export function getAuthUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  return req.user;
}

export function toSafeCourse(course: Course): Course {
  if (course.creator) {
    course.creator = {
      id: course.creator.id,
      name: course.creator.name,
    } as Course['creator'];
  }
  return course;
}

export class CoursesController extends BaseController {
  constructor(private readonly service: CoursesService = coursesService) {
    super();
  }

  // Course Endpoints
  public createCourse = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as CreateCourseInput;
    const course = await this.service.createCourse(body, user);
    const safe = toSafeCourse(course);
    res.status(StatusCodes.CREATED).json({
      success: true,
      status: 'success',
      data: {
        ...safe,
        course: safe,
      },
    });
  };

  public getCourseById = async (req: Request, res: Response): Promise<void> => {
    const includeOutline = req.query.outline === 'true';
    const course = await this.service.getCourseById(String(req.params.id), includeOutline);
    const safe = toSafeCourse(course);
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      data: {
        ...safe,
        course: safe,
      },
    });
  };

  public listCourses = async (req: Request, res: Response): Promise<void> => {
    const query = listCoursesQuerySchema.shape.query.parse(req.query);
    const { items, total } = await this.service.listCourses(query);
    const safeItems = items.map(toSafeCourse);
    const pagination = {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      data: {
        courses: safeItems,
        pagination,
      },
      meta: pagination,
    });
  };

  public updateCourse = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as UpdateCourseInput;
    const course = await this.service.updateCourse(String(req.params.id), body, user);
    const safe = toSafeCourse(course);
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      data: {
        ...safe,
        course: safe,
      },
    });
  };

  public toggleCourseStatus = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as StatusToggleInput;
    const course = await this.service.toggleCourseStatus(
      String(req.params.id),
      body.isActive,
      user,
      body.expectedUpdatedAt,
    );
    const safe = toSafeCourse(course);
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      data: {
        ...safe,
        course: safe,
      },
    });
  };

  public deleteCourse = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    await this.service.deleteCourse(String(req.params.id), user);
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      message: 'Course deleted successfully',
    });
  };

  public cloneCourse = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const cloned = await this.service.cloneCourse(String(req.params.id), user);
    const safe = toSafeCourse(cloned);
    res.status(StatusCodes.CREATED).json({
      success: true,
      status: 'success',
      data: {
        ...safe,
        course: safe,
      },
    });
  };

  public getCourseImpact = async (req: Request, res: Response): Promise<void> => {
    const impact = await this.service.getCourseImpact(String(req.params.id));
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      data: {
        ...impact,
        impact,
      },
    });
  };

  // Topic Endpoints
  public createTopic = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as CreateTopicInput;
    const topic = await this.service.createTopic(String(req.params.id), body, user);
    res.status(StatusCodes.CREATED).json({
      success: true,
      status: 'success',
      data: {
        ...topic,
        topic,
      },
    });
  };

  public updateTopic = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as UpdateTopicInput;
    const topic = await this.service.updateTopic(String(req.params.id), body, user);
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      data: {
        ...topic,
        topic,
      },
    });
  };

  public toggleTopicStatus = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as StatusToggleInput;
    const topic = await this.service.toggleTopicStatus(
      String(req.params.id),
      body.isActive,
      user,
      body.expectedUpdatedAt,
    );
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      data: {
        ...topic,
        topic,
      },
    });
  };

  public deleteTopic = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    await this.service.deleteTopic(String(req.params.id), user);
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      message: 'Topic deleted successfully',
    });
  };

  public reorderTopics = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as ReorderItemsInput;
    await this.service.reorderTopics(String(req.params.id), body.items, user);
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      message: 'Topics reordered successfully',
    });
  };

  // Subtopic Endpoints
  public createSubtopic = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as CreateSubtopicInput;
    const subtopic = await this.service.createSubtopic(String(req.params.id), body, user);
    res.status(StatusCodes.CREATED).json({
      success: true,
      status: 'success',
      data: {
        ...subtopic,
        subtopic,
      },
    });
  };

  public updateSubtopic = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as UpdateSubtopicInput;
    const subtopic = await this.service.updateSubtopic(String(req.params.id), body, user);
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      data: {
        ...subtopic,
        subtopic,
      },
    });
  };

  public toggleSubtopicStatus = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as StatusToggleInput;
    const subtopic = await this.service.toggleSubtopicStatus(
      String(req.params.id),
      body.isActive,
      user,
      body.expectedUpdatedAt,
    );
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      data: {
        ...subtopic,
        subtopic,
      },
    });
  };

  public deleteSubtopic = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    await this.service.deleteSubtopic(String(req.params.id), user);
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      message: 'Subtopic deleted successfully',
    });
  };

  public reorderSubtopics = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as ReorderItemsInput;
    await this.service.reorderSubtopics(String(req.params.id), body.items, user);
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      message: 'Subtopics reordered successfully',
    });
  };

  // Assignment Endpoints
  public createAssignment = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as CreateAssignmentInput;
    const assignment = await this.service.createAssignment(String(req.params.id), body, user);
    res.status(StatusCodes.CREATED).json({
      success: true,
      status: 'success',
      data: {
        ...assignment,
        assignment,
      },
    });
  };

  public updateAssignment = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as UpdateAssignmentInput;
    const assignment = await this.service.updateAssignment(String(req.params.id), body, user);
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      data: {
        ...assignment,
        assignment,
      },
    });
  };

  public deleteAssignment = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    await this.service.deleteAssignment(String(req.params.id), user);
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      message: 'Assignment deleted successfully',
    });
  };

  public reorderAssignments = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as ReorderItemsInput;
    await this.service.reorderAssignments(String(req.params.id), body.items, user);
    res.status(StatusCodes.OK).json({
      success: true,
      status: 'success',
      message: 'Assignments reordered successfully',
    });
  };
}

export const coursesController = new CoursesController();
