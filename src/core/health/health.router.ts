import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';

import { env } from '../config';
import { checkDatabaseHealth } from '../db';

const router = Router();

router.get('/live', (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', async (_req: Request, res: Response) => {
  const isDbHealthy = await checkDatabaseHealth();

  if (!isDbHealthy) {
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      status: 'unhealthy',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(StatusCodes.OK).json({
    status: 'ok',
    database: 'connected',
    commitSha: env.COMMIT_SHA,
    timestamp: new Date().toISOString(),
  });
});

export const healthRouter = router;
