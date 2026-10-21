import { randomUUID } from 'node:crypto';

import {
  hashPassword,
  RefreshTokenPayload,
  signAccessToken,
  signPasswordResetToken,
  signRefreshToken,
  verifyPassword,
  verifyPasswordResetToken,
  verifyRefreshToken,
} from '../../core/auth';
import { AppDataSource } from '../../core/db';
import { emailService } from '../../core/email';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../core/errors';
import { UserRepository, userRepository, UserRole } from '../users';
import { TokenRevokeReason, TokenType } from './entities/token.entity';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from './schemas/auth.schemas';
import { TokenRepository, tokenRepository } from './token.repository';

export interface AuthUserPayload {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUserPayload;
  tokens: AuthTokens;
}

export interface IAuthService {
  login(input: LoginInput): Promise<AuthResult>;
  refresh(refreshToken: string): Promise<AuthResult>;
  logout(refreshToken?: string): Promise<void>;
  forgotPassword(input: ForgotPasswordInput): Promise<void>;
  resetPassword(input: ResetPasswordInput): Promise<void>;
  changePassword(userId: string, input: ChangePasswordInput): Promise<void>;
}

export class AuthService implements IAuthService {
  constructor(
    private readonly userRepo: UserRepository = userRepository,
    private readonly tokenRepo: TokenRepository = tokenRepository,
  ) {}

  public async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValidPassword = await verifyPassword(user.passwordHash, input.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenError(
        'Your account has been deactivated. Please contact an administrator.',
      );
    }

    await this.userRepo.updateLastLogin(user.id);

    const jti = randomUUID();
    const familyId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.tokenRepo.createToken({
      userId: user.id,
      tokenType: TokenType.REFRESH,
      jti,
      familyId,
      tokenVersion: user.tokenVersion,
      expiresAt,
    });

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    const refreshToken = signRefreshToken({
      sub: user.id,
      jti,
      familyId,
      tokenVersion: user.tokenVersion,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  public async refresh(rawRefreshToken: string): Promise<AuthResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    let payload: RefreshTokenPayload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    return AppDataSource.transaction(async (manager) => {
      // Row-level locking to prevent race condition when concurrent /refresh requests arrive
      const tokenRow = await this.tokenRepo.findByJti(payload.jti, { lock: true, manager });
      if (!tokenRow || tokenRow.tokenType !== TokenType.REFRESH) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Reuse detection: if the token was already revoked, terminate the entire family
      if (tokenRow.revokedAt !== null) {
        if (tokenRow.familyId) {
          await this.tokenRepo.revokeFamily(
            tokenRow.familyId,
            TokenRevokeReason.REUSE_DETECTED,
            manager,
          );
        }
        throw new UnauthorizedError(
          'Token reuse detected. All sessions in this family have been terminated.',
        );
      }

      if (tokenRow.expiresAt < new Date()) {
        throw new UnauthorizedError('Refresh token has expired');
      }

      const user = await this.userRepo.findById(tokenRow.userId, manager);
      if (!user || !user.isActive || user.tokenVersion !== tokenRow.tokenVersion) {
        await this.tokenRepo.revokeByJti(
          tokenRow.jti,
          TokenRevokeReason.ROLE_CHANGED,
          undefined,
          manager,
        );
        throw new UnauthorizedError('Session is no longer valid');
      }

      // Token rotation: issue new token with same family_id first, then link replaced_by_id
      const newJti = randomUUID();
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const newToken = await this.tokenRepo.createToken(
        {
          userId: user.id,
          tokenType: TokenType.REFRESH,
          jti: newJti,
          familyId: tokenRow.familyId,
          tokenVersion: user.tokenVersion,
          expiresAt: newExpiresAt,
        },
        manager,
      );

      const revoked = await this.tokenRepo.revokeByJti(
        tokenRow.jti,
        TokenRevokeReason.ROTATED,
        newToken.id,
        manager,
      );
      if (!revoked) {
        if (tokenRow.familyId) {
          await this.tokenRepo.revokeFamily(
            tokenRow.familyId,
            TokenRevokeReason.REUSE_DETECTED,
            manager,
          );
        }
        throw new UnauthorizedError(
          'Token reuse detected. All sessions in this family have been terminated.',
        );
      }

      const accessToken = signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion,
      });

      const refreshToken = signRefreshToken({
        sub: user.id,
        jti: newJti,
        familyId: tokenRow.familyId ?? newJti,
        tokenVersion: user.tokenVersion,
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      };
    });
  }

  public async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    try {
      const payload = verifyRefreshToken(rawRefreshToken);
      await this.tokenRepo.revokeByJti(payload.jti, TokenRevokeReason.LOGOUT);
    } catch {
      // Ignore invalid token formatting on logout
    }
  }

  public async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user || !user.isActive) {
      return;
    }

    // Revoke previous unused reset tokens only (preserve active refresh sessions)
    await this.tokenRepo.revokeResetTokensForUser(user.id);

    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.tokenRepo.createToken({
      userId: user.id,
      tokenType: TokenType.PASSWORD_RESET,
      jti,
      expiresAt,
    });

    const resetToken = signPasswordResetToken({ sub: user.id, jti });
    await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetToken,
    });
  }

  public async resetPassword(input: ResetPasswordInput): Promise<void> {
    let jti = input.token;
    try {
      const payload = verifyPasswordResetToken(input.token);
      jti = payload.jti;
    } catch {
      // Token is looked up as jti
    }

    const tokenRow = await this.tokenRepo.findByJti(jti);
    if (
      !tokenRow ||
      tokenRow.tokenType !== TokenType.PASSWORD_RESET ||
      tokenRow.revokedAt !== null ||
      tokenRow.passwordResetUsedAt !== null ||
      tokenRow.expiresAt < new Date()
    ) {
      throw new UnauthorizedError('Invalid or expired password reset token');
    }

    const user = await this.userRepo.findById(tokenRow.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const passwordHash = await hashPassword(input.newPassword);

    await AppDataSource.transaction(async (manager) => {
      await this.userRepo.updatePassword(user.id, passwordHash, manager);
      await this.tokenRepo.markPasswordResetUsed(tokenRow.jti, manager);

      // Invalidate all existing refresh tokens across all sessions atomically
      await this.userRepo.incrementTokenVersion(user.id, manager);
      await this.tokenRepo.revokeAllForUser(user.id, TokenRevokeReason.PASSWORD_RESET, manager);
    });
  }

  public async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isValidPassword = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!isValidPassword) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const passwordHash = await hashPassword(input.newPassword);

    await AppDataSource.transaction(async (manager) => {
      await this.userRepo.updatePassword(user.id, passwordHash, manager);
      await this.userRepo.incrementTokenVersion(user.id, manager);
      await this.tokenRepo.revokeAllForUser(user.id, TokenRevokeReason.PASSWORD_CHANGED, manager);
    });
  }
}

export const authService = new AuthService();
