import { Router } from 'express';

import { requireAuth, requireRole } from '../../core/auth';
import { validate } from '../../core/http';
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
router.use(requireAuth);
router.use(requireRole(UserRole.SUPER_ADMIN));

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
