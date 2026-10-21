import type { CookieOptions, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { env } from '../../core/config';
import { NotFoundError, UnauthorizedError } from '../../core/errors';
import { UserRepository, userRepository } from '../users';
import { AuthService, authService } from './auth.service';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from './schemas/auth.schemas';

const isProduction = env.NODE_ENV === 'production';

const cookieDefaults: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
};

const accessCookieOptions: CookieOptions = {
  ...cookieDefaults,
  maxAge: 15 * 60 * 1000,
};

const refreshCookieOptions: CookieOptions = {
  ...cookieDefaults,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export class AuthController {
  constructor(
    private readonly service: AuthService = authService,
    private readonly userRepo: UserRepository = userRepository,
  ) {}

  public login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.login(req.body as LoginInput);

    res.cookie('accessToken', result.tokens.accessToken, accessCookieOptions);
    res.cookie('refreshToken', result.tokens.refreshToken, refreshCookieOptions);

    res.status(StatusCodes.OK).json({ success: true, data: result });
  };

  public refresh = async (req: Request, res: Response): Promise<void> => {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const body = (req.body ?? {}) as Record<string, string | undefined>;
    const token = cookies.refreshToken ?? body.refreshToken ?? '';

    const result = await this.service.refresh(token);

    res.cookie('accessToken', result.tokens.accessToken, accessCookieOptions);
    res.cookie('refreshToken', result.tokens.refreshToken, refreshCookieOptions);

    res.status(StatusCodes.OK).json({ success: true, data: result });
  };

  public logout = async (req: Request, res: Response): Promise<void> => {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const body = (req.body ?? {}) as Record<string, string | undefined>;
    const token = cookies.refreshToken ?? body.refreshToken;

    await this.service.logout(token);

    res.clearCookie('accessToken', cookieDefaults);
    res.clearCookie('refreshToken', cookieDefaults);

    res.status(StatusCodes.OK).json({ success: true, message: 'Logged out successfully' });
  };

  public getMe = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const user = await this.userRepo.findById(req.user.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        },
      },
    });
  };

  public forgotPassword = async (req: Request, res: Response): Promise<void> => {
    await this.service.forgotPassword(req.body as ForgotPasswordInput);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'If the email exists, a password reset link has been sent',
    });
  };

  public resetPassword = async (req: Request, res: Response): Promise<void> => {
    await this.service.resetPassword(req.body as ResetPasswordInput);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Password reset successfully. You may now log in.',
    });
  };

  public changePassword = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    await this.service.changePassword(userId, req.body as ChangePasswordInput);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Password changed successfully',
    });
  };
}

export const authController = new AuthController();
