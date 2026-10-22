import { Router } from 'express';

import { validate } from '../../core/http';
import { requireAuth, requireRole } from '../auth';
import { UserRole } from './entities/user.entity';
import { usersController } from './users.controller';
import {
  changeRoleRequestSchema,
  createUserRequestSchema,
  getRoleImpactRequestSchema,
  getUserByIdSchema,
  listUsersSchema,
  resendInviteRequestSchema,
  updateUserRequestSchema,
  userStatusRequestSchema,
} from './users.schemas';

const router = Router();

// Module 2 is Super Admin only (PRD §2)
router.use((req, res, next) => requireAuth(req, res, next));
router.use((req, res, next) => requireRole(UserRole.SUPER_ADMIN)(req, res, next));

router.get('/', validate(listUsersSchema), usersController.list);
router.post('/', validate(createUserRequestSchema), usersController.create);
router.get('/:id', validate(getUserByIdSchema), usersController.getById);
router.patch('/:id', validate(updateUserRequestSchema), usersController.update);
router.get('/:id/role-impact', validate(getRoleImpactRequestSchema), usersController.getRoleImpact);
router.patch('/:id/role', validate(changeRoleRequestSchema), usersController.changeRole);
router.patch('/:id/deactivate', validate(userStatusRequestSchema), usersController.deactivate);
router.patch('/:id/activate', validate(userStatusRequestSchema), usersController.activate);
router.post(
  '/:id/resend-invite',
  validate(resendInviteRequestSchema),
  usersController.resendInvite,
);

export const usersRouter = router;
