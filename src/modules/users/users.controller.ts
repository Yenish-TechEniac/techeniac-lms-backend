import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import type { ChangeRoleInput, CreateUserInput, UpdateUserInput } from './users.schemas';
import { UsersService, usersService } from './users.service';

export class UsersController {
  constructor(private readonly service: UsersService = usersService) {}

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listUsers(req.query as never);
      res.status(StatusCodes.OK).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service.getUserById(String(req.params.id));
      res.status(StatusCodes.OK).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service.createUser(req.body as CreateUserInput, req.user?.id);
      res.status(StatusCodes.CREATED).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service.updateUser(
        String(req.params.id),
        req.body as UpdateUserInput,
      );
      res.status(StatusCodes.OK).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  public changeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.changeRole(
        String(req.params.id),
        req.body as ChangeRoleInput,
        req.user?.id,
      );
      res.status(StatusCodes.OK).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  public deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service.toggleUserStatus(String(req.params.id), false, req.user?.id);
      res.status(StatusCodes.OK).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  public activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service.toggleUserStatus(String(req.params.id), true, req.user?.id);
      res.status(StatusCodes.OK).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  public getRoleImpact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getRoleImpact(
        String(req.params.id),
        req.query.newRole as never,
      );
      res.status(StatusCodes.OK).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  public resendInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.resendInvite(String(req.params.id));
      res.status(StatusCodes.OK).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const usersController = new UsersController();
