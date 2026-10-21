import crypto from 'node:crypto';

import { StatusCodes } from 'http-status-codes';

import { hashPassword } from '../../core/auth/password';
import { emailService } from '../../core/email';
import { AppError, NotFoundError } from '../../core/errors';
import { logger } from '../../core/logging';
import { type User, UserRole } from './entities/user.entity';
import type { UserRoleHistory } from './entities/user-role-history.entity';
import { UsersRepository, usersRepository } from './users.repository';
import type {
  ChangeRoleInput,
  CreateUserInput,
  UpdateUserInput,
  UserQueryParams,
} from './users.schemas';

function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;

  const chars = [
    upper[crypto.randomInt(0, upper.length)]!,
    lower[crypto.randomInt(0, lower.length)]!,
    digits[crypto.randomInt(0, digits.length)]!,
    special[crypto.randomInt(0, special.length)]!,
  ];

  for (let i = 4; i < 14; i++) {
    chars.push(all[crypto.randomInt(0, all.length)]!);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const temp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = temp;
  }

  return chars.join('');
}

export class UsersService {
  constructor(private readonly repo: UsersRepository = usersRepository) {}

  public async listUsers(
    params: UserQueryParams,
  ): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
    const [users, total] = await this.repo.findAll({ ...params, page, limit });
    return { users, total, page, limit };
  }

  public async getUserById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new NotFoundError(`User with id '${id}' not found`);
    }
    return user;
  }

  public async createUser(input: CreateUserInput, actorId?: string): Promise<User> {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      throw new AppError(
        'A user with this email already exists',
        StatusCodes.CONFLICT,
        'DUPLICATE_EMAIL',
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const user = await this.repo.create({
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash,
      mustChangePassword: true,
    });

    await this.repo.saveRoleHistory({
      userId: user.id,
      role: user.role,
      reason: 'Initial role assignment upon user creation',
      changedBy: actorId ?? null,
    });

    emailService
      .sendInviteEmail({
        to: user.email,
        name: user.name,
        temporaryPassword,
        role: user.role,
      })
      .catch((err) => {
        logger.error({ err, userId: user.id }, 'Async invite email dispatch failed');
      });

    return user;
  }

  public async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const user = await this.getUserById(id);

    if (input.email && input.email !== user.email) {
      const existing = await this.repo.findByEmail(input.email);
      if (existing) {
        throw new AppError(
          'A user with this email already exists',
          StatusCodes.CONFLICT,
          'DUPLICATE_EMAIL',
        );
      }
      user.email = input.email;
    }

    if (input.name) {
      user.name = input.name;
    }

    return this.repo.save(user);
  }

  public async changeRole(
    id: string,
    input: ChangeRoleInput,
    actorId?: string,
  ): Promise<{ user: User; history: UserRoleHistory }> {
    const user = await this.getUserById(id);

    if (user.role === input.newRole) {
      throw new AppError(
        'User already has the requested role',
        StatusCodes.BAD_REQUEST,
        'SAME_ROLE_NO_OP',
      );
    }

    if (actorId && actorId === id) {
      throw new AppError(
        'Super Admin cannot change own role',
        StatusCodes.FORBIDDEN,
        'CANNOT_CHANGE_OWN_ROLE',
      );
    }

    if (
      user.role === UserRole.MENTOR &&
      (input.newRole === UserRole.MENTEE || input.newRole === UserRole.SUPER_ADMIN)
    ) {
      throw new AppError(
        'Mentor role cannot be changed to Mentee or Super Admin as per LMS policy',
        StatusCodes.BAD_REQUEST,
        'CANNOT_CHANGE_MENTOR_ROLE',
      );
    }

    if (
      user.role === UserRole.SUPER_ADMIN &&
      (input.newRole === UserRole.MENTOR || input.newRole === UserRole.MENTEE)
    ) {
      throw new AppError(
        'Super Admin role cannot be changed into Mentor or Mentee as per LMS policy',
        StatusCodes.BAD_REQUEST,
        'CANNOT_CHANGE_SUPER_ADMIN_ROLE',
      );
    }

    if (user.role === UserRole.SUPER_ADMIN && input.newRole !== UserRole.SUPER_ADMIN) {
      const activeAdmins = await this.repo.countActiveSuperAdmins();
      if (activeAdmins <= 1) {
        throw new AppError(
          'Cannot demote the last active Super Admin',
          StatusCodes.BAD_REQUEST,
          'LAST_SUPER_ADMIN',
        );
      }
    }

    user.role = input.newRole;
    user.tokenVersion += 1;

    const savedUser = await this.repo.save(user);

    await this.repo.closeActiveRoleHistory(user.id);

    const history = await this.repo.saveRoleHistory({
      userId: user.id,
      role: input.newRole,
      reason: input.reason,
      changedBy: actorId ?? null,
    });

    return { user: savedUser, history };
  }

  public async toggleUserStatus(id: string, isActive: boolean, actorId?: string): Promise<User> {
    const user = await this.getUserById(id);

    if (actorId && actorId === id && !isActive) {
      throw new AppError(
        'Super Admin cannot deactivate own account',
        StatusCodes.FORBIDDEN,
        'CANNOT_DEACTIVATE_SELF',
      );
    }

    if (!isActive && user.role === UserRole.SUPER_ADMIN) {
      const activeAdmins = await this.repo.countActiveSuperAdmins();
      if (activeAdmins <= 1) {
        throw new AppError(
          'Cannot deactivate the last active Super Admin',
          StatusCodes.BAD_REQUEST,
          'LAST_SUPER_ADMIN',
        );
      }
    }

    user.isActive = isActive;
    if (!isActive) {
      user.tokenVersion += 1;
    }

    return this.repo.save(user);
  }

  public async getRoleImpact(
    id: string,
    newRole: UserRole,
  ): Promise<{
    userId: string;
    name: string;
    email: string;
    currentRole: UserRole;
    newRole: UserRole;
    isSameRole: boolean;
    willRevokeSessions: boolean;
    impactSummary: string;
  }> {
    const user = await this.getUserById(id);
    const isSameRole = user.role === newRole;

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      currentRole: user.role,
      newRole,
      isSameRole,
      willRevokeSessions: !isSameRole,
      impactSummary: isSameRole
        ? `User already has the role ${newRole}. No changes will be applied.`
        : `Changing role from ${user.role} to ${newRole} will invalidate all active sessions and reassign permissions immediately.`,
    };
  }

  public async resendInvite(id: string): Promise<{ message: string }> {
    const user = await this.getUserById(id);

    if (user.lastLoginAt !== null) {
      throw new AppError(
        'User has already logged in and set up their password',
        StatusCodes.BAD_REQUEST,
        'USER_ALREADY_LOGGED_IN',
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    user.passwordHash = await hashPassword(temporaryPassword);
    user.mustChangePassword = true;
    user.tokenVersion += 1;
    await this.repo.save(user);

    emailService
      .sendInviteEmail({
        to: user.email,
        name: user.name,
        temporaryPassword,
        role: user.role,
      })
      .catch((err) => {
        logger.error({ err, userId: user.id }, 'Async resend invite email dispatch failed');
      });

    return { message: `Invite successfully resent to ${user.email}` };
  }
}

export const usersService = new UsersService();
