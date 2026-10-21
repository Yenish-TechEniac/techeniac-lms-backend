import { Router } from 'express';

import { requireAuth } from '../../core/auth';
import {
  loginRateLimiter,
  passwordResetRateLimiter,
  refreshRateLimiter,
  validate,
} from '../../core/http';
import { authController } from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordSchema,
} from './schemas/auth.schemas';

export const authRouter = Router();

authRouter.post('/login', loginRateLimiter, validate(loginSchema), authController.login);
authRouter.post(
  '/refresh',
  refreshRateLimiter,
  validate(refreshTokenSchema),
  authController.refresh,
);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.getMe);
authRouter.post(
  '/forgot-password',
  passwordResetRateLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
authRouter.post(
  '/reset-password',
  passwordResetRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);
authRouter.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  authController.changePassword,
);
