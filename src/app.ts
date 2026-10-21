import cookieParser from 'cookie-parser';
import express, { Express } from 'express';
import { StatusCodes } from 'http-status-codes';

import { env } from './core/config';
import { healthRouter } from './core/health';
import { corsMiddleware, errorMiddleware, notFoundMiddleware } from './core/http';
import { authRouter } from './modules/auth';
import { usersRouter } from './modules/users';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(corsMiddleware);
  app.use(cookieParser());
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

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

export const app = createApp();
