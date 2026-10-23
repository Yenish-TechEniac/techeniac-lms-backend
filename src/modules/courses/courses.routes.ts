import { Router } from 'express';

import { requireAuth, requireRole } from '../../core/auth';
import { validate } from '../../core/http';
import { coursesController } from './courses.controller';
import {
  courseIdParamSchema,
  createAssignmentSchema,
  createCourseSchema,
  createSubtopicSchema,
  createTopicSchema,
  listCoursesQuerySchema,
  reorderItemsSchema,
  statusToggleSchema,
  updateAssignmentSchema,
  updateCourseSchema,
  updateSubtopicSchema,
  updateTopicSchema,
} from './schemas/courses.schemas';

export const coursesRouter = Router();

// All course builder endpoints require authentication and SUPER_ADMIN or MENTOR role
coursesRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'MENTOR'));

// --- Course Routes ---
coursesRouter.get('/', validate(listCoursesQuerySchema), (req, res, next) => {
  coursesController.listCourses(req, res).catch(next);
});

coursesRouter.post('/', validate(createCourseSchema), (req, res, next) => {
  coursesController.createCourse(req, res).catch(next);
});

coursesRouter.get('/:id', validate(courseIdParamSchema), (req, res, next) => {
  coursesController.getCourseById(req, res).catch(next);
});

coursesRouter.put('/:id', validate(updateCourseSchema), (req, res, next) => {
  coursesController.updateCourse(req, res).catch(next);
});

coursesRouter.patch('/:id/status', validate(statusToggleSchema), (req, res, next) => {
  coursesController.toggleCourseStatus(req, res).catch(next);
});

coursesRouter.delete('/:id', validate(courseIdParamSchema), (req, res, next) => {
  coursesController.deleteCourse(req, res).catch(next);
});

coursesRouter.post('/:id/clone', validate(courseIdParamSchema), (req, res, next) => {
  coursesController.cloneCourse(req, res).catch(next);
});

coursesRouter.get('/:id/impact', validate(courseIdParamSchema), (req, res, next) => {
  coursesController.getCourseImpact(req, res).catch(next);
});

// --- Topic Routes ---
coursesRouter.post('/:id/topics', validate(createTopicSchema), (req, res, next) => {
  coursesController.createTopic(req, res).catch(next);
});

coursesRouter.put('/topics/:id', validate(updateTopicSchema), (req, res, next) => {
  coursesController.updateTopic(req, res).catch(next);
});

coursesRouter.patch('/topics/:id/status', validate(statusToggleSchema), (req, res, next) => {
  coursesController.toggleTopicStatus(req, res).catch(next);
});

coursesRouter.delete('/topics/:id', (req, res, next) => {
  coursesController.deleteTopic(req, res).catch(next);
});

coursesRouter.put('/:id/topics/reorder', validate(reorderItemsSchema), (req, res, next) => {
  coursesController.reorderTopics(req, res).catch(next);
});

// --- Subtopic Routes ---
coursesRouter.post('/topics/:id/subtopics', validate(createSubtopicSchema), (req, res, next) => {
  coursesController.createSubtopic(req, res).catch(next);
});

coursesRouter.put('/subtopics/:id', validate(updateSubtopicSchema), (req, res, next) => {
  coursesController.updateSubtopic(req, res).catch(next);
});

coursesRouter.patch('/subtopics/:id/status', validate(statusToggleSchema), (req, res, next) => {
  coursesController.toggleSubtopicStatus(req, res).catch(next);
});

coursesRouter.delete('/subtopics/:id', (req, res, next) => {
  coursesController.deleteSubtopic(req, res).catch(next);
});

coursesRouter.put(
  '/topics/:id/subtopics/reorder',
  validate(reorderItemsSchema),
  (req, res, next) => {
    coursesController.reorderSubtopics(req, res).catch(next);
  },
);

// --- Assignment Routes ---
coursesRouter.post('/:id/assignments', validate(createAssignmentSchema), (req, res, next) => {
  coursesController.createAssignment(req, res).catch(next);
});

coursesRouter.put('/assignments/:id', validate(updateAssignmentSchema), (req, res, next) => {
  coursesController.updateAssignment(req, res).catch(next);
});

coursesRouter.delete('/assignments/:id', (req, res, next) => {
  coursesController.deleteAssignment(req, res).catch(next);
});

coursesRouter.put('/:id/assignments/reorder', validate(reorderItemsSchema), (req, res, next) => {
  coursesController.reorderAssignments(req, res).catch(next);
});
