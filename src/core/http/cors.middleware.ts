import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { env } from '../config';

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  if (origin && env.CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    res.status(StatusCodes.NO_CONTENT).end();
    return;
  }

  next();
}
