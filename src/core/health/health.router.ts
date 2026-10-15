import { Request, Response, Router } from 'express';

import { config } from '../config';
import { checkDatabaseHealth } from '../db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  void (async () => {
    const isDbHealthy = await checkDatabaseHealth();

    res.status(isDbHealthy ? 200 : 503).json({
      status: isDbHealthy ? 'ok' : 'degraded',
      database: isDbHealthy ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      commitSha: config.COMMIT_SHA,
      timestamp: new Date().toISOString(),
    });
  })();
});

router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', (_req: Request, res: Response) => {
  void (async () => {
    const isDbHealthy = await checkDatabaseHealth();

    if (!isDbHealthy) {
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(200).json({
      status: 'ok',
      database: 'connected',
      commitSha: config.COMMIT_SHA,
      timestamp: new Date().toISOString(),
    });
  })();
});

export const healthRouter = router;
