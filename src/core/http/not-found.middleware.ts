import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';

export const notFoundMiddleware: RequestHandler = (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};
