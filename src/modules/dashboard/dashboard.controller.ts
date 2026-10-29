import type { NextFunction, Request, Response } from 'express';

import type { AuthenticatedUser } from '../../core/auth';
import { UnauthorizedError } from '../../core/errors';
import { BaseController } from '../../core/http';
import { DashboardService, dashboardService } from './dashboard.service';

export class DashboardController extends BaseController {
  constructor(private readonly service: DashboardService = dashboardService) {
    super();
  }

  private getAuthUser(req: Request): AuthenticatedUser {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    return req.user;
  }

  public getAdminDashboard = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.service.getAdminDashboard();
      this.sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  };

  public getMentorDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = this.getAuthUser(req);
      const data = await this.service.getMentorDashboard(user.id);
      this.sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  };

  public getMenteeDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = this.getAuthUser(req);
      const data = await this.service.getMenteeDashboard(user.id);
      this.sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  };
}

export const dashboardController = new DashboardController();
