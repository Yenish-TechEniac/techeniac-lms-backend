import { Router } from 'express';

import { validate } from '../../core/http';
import { requireAuth, requireRole } from '../auth';
import { coursesController } from './courses.controller';
import {
  courseIdParamSchema,
  createAssignmentSchema,
  createCourseSchema,
  createSubtopicSchema,
  createTopicSchema,
  idParamSchema,
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
coursesRouter.get('/', validate(listCoursesQuerySchema), coursesController.listCourses);
coursesRouter.post('/', validate(createCourseSchema), coursesController.createCourse);
coursesRouter.get('/:id', validate(courseIdParamSchema), coursesController.getCourseById);
coursesRouter.put('/:id', validate(updateCourseSchema), coursesController.updateCourse);
coursesRouter.patch(
  '/:id/status',
  validate(statusToggleSchema),
  coursesController.toggleCourseStatus,
);
coursesRouter.delete('/:id', validate(courseIdParamSchema), coursesController.deleteCourse);
coursesRouter.post('/:id/clone', validate(courseIdParamSchema), coursesController.cloneCourse);
coursesRouter.get('/:id/impact', validate(courseIdParamSchema), coursesController.getCourseImpact);

// --- Topic Routes ---
coursesRouter.post('/:id/topics', validate(createTopicSchema), coursesController.createTopic);
coursesRouter.put('/topics/:id', validate(updateTopicSchema), coursesController.updateTopic);
coursesRouter.patch(
  '/topics/:id/status',
  validate(statusToggleSchema),
  coursesController.toggleTopicStatus,
);
coursesRouter.delete('/topics/:id', validate(idParamSchema), coursesController.deleteTopic);
coursesRouter.put(
  '/:id/topics/reorder',
  validate(reorderItemsSchema),
  coursesController.reorderTopics,
);

// --- Subtopic Routes ---
coursesRouter.post(
  '/topics/:id/subtopics',
  validate(createSubtopicSchema),
  coursesController.createSubtopic,
);
coursesRouter.put(
  '/subtopics/:id',
  validate(updateSubtopicSchema),
  coursesController.updateSubtopic,
);
coursesRouter.patch(
  '/subtopics/:id/status',
  validate(statusToggleSchema),
  coursesController.toggleSubtopicStatus,
);
coursesRouter.delete('/subtopics/:id', validate(idParamSchema), coursesController.deleteSubtopic);
coursesRouter.put(
  '/topics/:id/subtopics/reorder',
  validate(reorderItemsSchema),
  coursesController.reorderSubtopics,
);

// --- Assignment Routes ---
coursesRouter.post(
  '/:id/assignments',
  validate(createAssignmentSchema),
  coursesController.createAssignment,
);
coursesRouter.put(
  '/assignments/:id',
  validate(updateAssignmentSchema),
  coursesController.updateAssignment,
);
coursesRouter.delete(
  '/assignments/:id',
  validate(idParamSchema),
  coursesController.deleteAssignment,
);
coursesRouter.put(
  '/:id/assignments/reorder',
  validate(reorderItemsSchema),
  coursesController.reorderAssignments,
);
