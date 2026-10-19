import pino from 'pino';

export const logger = pino({
  level: 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = pino.Logger;
