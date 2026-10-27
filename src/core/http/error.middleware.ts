import type { ErrorRequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';

import { env } from '../config';
import { AppError } from '../errors';
import { logger } from '../logging';

export const errorMiddleware: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const status =
    err instanceof AppError
      ? err.status
      : typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : Number(StatusCodes.INTERNAL_SERVER_ERROR);

  const code =
    err instanceof AppError
      ? err.code
      : status >= 500
        ? 'INTERNAL_ERROR'
        : typeof (err as { code?: unknown }).code === 'string'
          ? (err as { code: string }).code
          : status === Number(StatusCodes.BAD_REQUEST)
            ? 'BAD_REQUEST'
            : 'REQUEST_ERROR';

  if (status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled server error');
  }

  const message =
    err instanceof AppError
      ? err.message
      : env.NODE_ENV === 'production' && status >= 500
        ? 'Something went wrong'
        : (err as Error).message || 'An error occurred';

  res.status(status).json({
    error: {
      code,
      message,
      ...(err instanceof AppError && err.details ? { details: err.details } : {}),
    },
  });
};
