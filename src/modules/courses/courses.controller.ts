import type { Request, Response } from 'express';

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
    this.sendCreated(res, toSafeCourse(course));
  };

  public getCourseById = async (req: Request, res: Response): Promise<void> => {
    const includeOutline = req.query.outline === 'true';
    const course = await this.service.getCourseById(String(req.params.id), includeOutline);
    this.sendSuccess(res, toSafeCourse(course));
  };

  public listCourses = async (req: Request, res: Response): Promise<void> => {
    const query = listCoursesQuerySchema.shape.query.parse(req.query);
    const { items, total } = await this.service.listCourses(query);
    this.sendPaginated(res, items.map(toSafeCourse), query.page, query.limit, total);
  };

  public updateCourse = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as UpdateCourseInput;
    const course = await this.service.updateCourse(String(req.params.id), body, user);
    this.sendSuccess(res, toSafeCourse(course));
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
    this.sendSuccess(res, toSafeCourse(course));
  };

  public deleteCourse = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    await this.service.deleteCourse(String(req.params.id), user);
    this.sendMessage(res, 'Course deleted successfully');
  };

  public cloneCourse = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const cloned = await this.service.cloneCourse(String(req.params.id), user);
    this.sendCreated(res, toSafeCourse(cloned));
  };

  public getCourseImpact = async (req: Request, res: Response): Promise<void> => {
    const impact = await this.service.getCourseImpact(String(req.params.id));
    this.sendSuccess(res, impact);
  };

  // Topic Endpoints
  public createTopic = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as CreateTopicInput;
    const topic = await this.service.createTopic(String(req.params.id), body, user);
    this.sendCreated(res, topic);
  };

  public updateTopic = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as UpdateTopicInput;
    const topic = await this.service.updateTopic(String(req.params.id), body, user);
    this.sendSuccess(res, topic);
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
    this.sendSuccess(res, topic);
  };

  public deleteTopic = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    await this.service.deleteTopic(String(req.params.id), user);
    this.sendMessage(res, 'Topic deleted successfully');
  };

  public reorderTopics = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as ReorderItemsInput;
    await this.service.reorderTopics(String(req.params.id), body.items, user);
    this.sendMessage(res, 'Topics reordered successfully');
  };

  // Subtopic Endpoints
  public createSubtopic = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as CreateSubtopicInput;
    const subtopic = await this.service.createSubtopic(String(req.params.id), body, user);
    this.sendCreated(res, subtopic);
  };

  public updateSubtopic = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as UpdateSubtopicInput;
    const subtopic = await this.service.updateSubtopic(String(req.params.id), body, user);
    this.sendSuccess(res, subtopic);
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
    this.sendSuccess(res, subtopic);
  };

  public deleteSubtopic = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    await this.service.deleteSubtopic(String(req.params.id), user);
    this.sendMessage(res, 'Subtopic deleted successfully');
  };

  public reorderSubtopics = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as ReorderItemsInput;
    await this.service.reorderSubtopics(String(req.params.id), body.items, user);
    this.sendMessage(res, 'Subtopics reordered successfully');
  };

  // Assignment Endpoints
  public createAssignment = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as CreateAssignmentInput;
    const assignment = await this.service.createAssignment(String(req.params.id), body, user);
    this.sendCreated(res, assignment);
  };

  public updateAssignment = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as UpdateAssignmentInput;
    const assignment = await this.service.updateAssignment(String(req.params.id), body, user);
    this.sendSuccess(res, assignment);
  };

  public deleteAssignment = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    await this.service.deleteAssignment(String(req.params.id), user);
    this.sendMessage(res, 'Assignment deleted successfully');
  };

  public reorderAssignments = async (req: Request, res: Response): Promise<void> => {
    const user = getAuthUser(req);
    const body = req.body as ReorderItemsInput;
    await this.service.reorderAssignments(String(req.params.id), body.items, user);
    this.sendMessage(res, 'Assignments reordered successfully');
  };
}

export const coursesController = new CoursesController();
