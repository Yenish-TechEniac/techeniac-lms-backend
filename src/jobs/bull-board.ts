import { createHash, timingSafeEqual } from 'node:crypto';

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Queue } from 'bullmq';
import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { env } from '../core/config';

export const BULL_BOARD_BASE_PATH = '/admin/queues';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(BULL_BOARD_BASE_PATH);

const board = createBullBoard({ queues: [], serverAdapter });

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function extractPassword(header: string | undefined): string | null {
  if (!header?.startsWith('Basic ')) {
    return null;
  }

  const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  return separatorIndex === -1 ? null : decoded.slice(separatorIndex + 1);
}

/** Compares the Basic auth password (any username) against BULL_BOARD_PASSWORD in constant time. */
export function bullBoardAuthMiddleware(expectedPassword: string) {
  const expectedDigest = digest(expectedPassword);

  return (req: Request, res: Response, next: NextFunction): void => {
    const provided = extractPassword(req.headers.authorization);

    if (provided !== null && timingSafeEqual(digest(provided), expectedDigest)) {
      next();
      return;
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board", charset="UTF-8"');
    res.status(StatusCodes.UNAUTHORIZED).send('Authentication required');
  };
}

export function registerBullBoardQueue(queue: Queue): void {
  board.addQueue(new BullMQAdapter(queue));
}

/** Mounts the password-protected dashboard; stays disabled when BULL_BOARD_PASSWORD is unset. */
export function mountBullBoard(app: Express): void {
  if (!env.BULL_BOARD_PASSWORD) {
    return;
  }

  app.use(
    BULL_BOARD_BASE_PATH,
    bullBoardAuthMiddleware(env.BULL_BOARD_PASSWORD),
    serverAdapter.getRouter() as RequestHandler,
  );
}
