import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { AuthService, authService } from './auth.service';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from './schemas/auth.schemas';

export class AuthController {
  constructor(private readonly service: AuthService = authService) {}

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.login(req.body as LoginInput);
      res.status(StatusCodes.OK).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  public refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
      const body = (req.body ?? {}) as Record<string, string | undefined>;
      const token = cookies.refreshToken ?? body.refreshToken ?? '';
      const result = await this.service.refresh(token);
      res.status(StatusCodes.OK).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  public logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
      const body = (req.body ?? {}) as Record<string, string | undefined>;
      const token = cookies.refreshToken ?? body.refreshToken;
      await this.service.logout(token);
      res.status(StatusCodes.OK).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  };

  public forgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.service.forgotPassword(req.body as ForgotPasswordInput);
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      });
    } catch (error) {
      next(error);
    }
  };

  public resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.resetPassword(req.body as ResetPasswordInput);
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Password reset successfully. You may now log in.',
      });
    } catch (error) {
      next(error);
    }
  };

  public changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = (req as unknown as { user?: { id: string } }).user?.id ?? '';
      await this.service.changePassword(userId, req.body as ChangePasswordInput);
      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
