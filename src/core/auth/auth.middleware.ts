import type { NextFunction, Request, Response } from 'express';

// Imported directly to prevent circular dependency with users.routes.ts -> core/auth
// eslint-disable-next-line architecture/cross-module-index-imports
import { userRepository } from '../../modules/users/user.repository';
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

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
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

    // FR-1.6: Verify tokenVersion and active state against live user row on every request
    const user = await userRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      next(new UnauthorizedError('Account is inactive or disabled'));
      return;
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      next(new UnauthorizedError('Session has expired or credentials have been updated'));
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }
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
