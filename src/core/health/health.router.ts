import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';

import { env } from '../config';
import { checkDatabaseHealth } from '../db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  void (async () => {
    const isDbHealthy = await checkDatabaseHealth();

    res.status(isDbHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
      status: isDbHealthy ? 'ok' : 'degraded',
      database: isDbHealthy ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      commitSha: env.COMMIT_SHA,
      timestamp: new Date().toISOString(),
    });
  })();
});

router.get('/live', (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', (_req: Request, res: Response) => {
  void (async () => {
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
  })();
});

export const healthRouter = router;
