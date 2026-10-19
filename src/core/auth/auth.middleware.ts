import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError, UnauthorizedError } from '../errors';
import { verifyAccessToken } from './jwt';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  tokenVersion: number;
}

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
  const authHeader = req.headers.authorization;

  let token = cookies.accessToken;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    next(new UnauthorizedError('Authentication token is required'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tokenVersion: payload.tokenVersion,
    };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired authentication token'));
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient permissions for this resource'));
      return;
    }

    next();
  };
}
