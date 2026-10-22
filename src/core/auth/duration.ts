import { env } from '../config';

export function parseDurationMs(duration: string | number, defaultMs: number): number {
  if (typeof duration === 'number') {
    return duration;
  }
  if (!duration || typeof duration !== 'string') {
    return defaultMs;
  }
  const match = /^(\d+)\s*(ms|s|m|h|d|w)?$/i.exec(duration.trim());
  if (!match?.[1]) {
    return defaultMs;
  }
  const val = Number.parseInt(match[1], 10);
  const unit = (match[2] || 'ms').toLowerCase();
  switch (unit) {
    case 'ms':
      return val;
    case 's':
      return val * 1000;
    case 'm':
      return val * 60 * 1000;
    case 'h':
      return val * 60 * 60 * 1000;
    case 'd':
      return val * 24 * 60 * 60 * 1000;
    case 'w':
      return val * 7 * 24 * 60 * 60 * 1000;
    default:
      return defaultMs;
  }
}

export const ACCESS_TOKEN_TTL_MS = parseDurationMs(env.ACCESS_TOKEN_TTL, 15 * 60 * 1000);
export const REFRESH_TOKEN_TTL_MS = parseDurationMs(env.REFRESH_TOKEN_TTL, 7 * 24 * 60 * 60 * 1000);
