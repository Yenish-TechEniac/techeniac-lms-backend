import express, { Express } from 'express';
import { StatusCodes } from 'http-status-codes';

import { env } from './core/config';
import { healthRouter } from './core/health';
import { corsMiddleware } from './core/http';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(corsMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/health', healthRouter);

  app.get('/api/v1', (_req, res) => {
    res.status(StatusCodes.OK).json({
      name: 'techeniac-lms-backend',
      version: '0.1.0',
      status: 'operational',
    });
  });

  return app;
}

export const app = createApp();
