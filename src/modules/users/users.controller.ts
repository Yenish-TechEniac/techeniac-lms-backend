import type { Request, Response } from 'express';

import { BaseController } from '../../core/http';
import { UserRole } from './entities/user.entity';
import type {
  ChangeRoleInput,
  CreateUserInput,
  UpdateUserInput,
  UserQueryParams,
} from './users.schemas';
import { type SafeUser, toSafeUser, UsersService, usersService } from './users.service';

export type { SafeUser };
export { toSafeUser };

export class UsersController extends BaseController {
  constructor(private readonly service: UsersService = usersService) {
    super();
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.listUsers(req.query as unknown as UserQueryParams);
    this.sendSuccess(res, {
      ...result,
      users: result.users.map(toSafeUser),
    });
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.getUserById(String(req.params.id));
    this.sendSuccess(res, toSafeUser(user));
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.createUser(req.body as CreateUserInput, req.user?.id);
    this.sendCreated(res, toSafeUser(user));
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.updateUser(String(req.params.id), req.body as UpdateUserInput);
    this.sendSuccess(res, toSafeUser(user));
  };

  public changeRole = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.changeRole(
      String(req.params.id),
      req.body as ChangeRoleInput,
      req.user?.id,
    );
    this.sendSuccess(res, {
      ...result,
      user: toSafeUser(result.user),
    });
  };

  public deactivate = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.toggleUserStatus(String(req.params.id), false, req.user?.id);
    this.sendSuccess(res, toSafeUser(user));
  };

  public activate = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.toggleUserStatus(String(req.params.id), true, req.user?.id);
    this.sendSuccess(res, toSafeUser(user));
  };

  public getRoleImpact = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.getRoleImpact(
      String(req.params.id),
      req.query.newRole as UserRole,
    );
    this.sendSuccess(res, result);
  };

  public resendInvite = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.resendInvite(String(req.params.id));
    this.sendSuccess(res, result);
  };
}

export const usersController = new UsersController();
