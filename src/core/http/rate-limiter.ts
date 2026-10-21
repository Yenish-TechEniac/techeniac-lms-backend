import type { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';

const rateLimitHandler = (_req: Request, res: Response) => {
  res.status(StatusCodes.TOO_MANY_REQUESTS).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
    },
  });
};

/**
 * Login: 10 failed attempts / 15 min per IP + normalized email (PRD Section 5.6).
 * Successful logins are not counted (skipSuccessfulRequests: true).
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request) => {
    const body = req.body as Record<string, unknown> | undefined;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const ip = ipKeyGenerator(rawIp);
    return email ? `${ip}:${email}` : ip;
  },
});

/**
 * Forgot / reset password: 5 requests / 15 min per IP (PRD Section 5.6).
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Refresh token: 30 requests / 15 min per IP (PRD Section 5.6).
 */
export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
