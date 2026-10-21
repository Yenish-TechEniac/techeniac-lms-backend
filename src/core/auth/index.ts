export { requireAuth, requireRole } from './auth.middleware';
export type { AuthenticatedUser } from './auth.types';
export { ACCESS_TOKEN_TTL_MS, parseDurationMs, REFRESH_TOKEN_TTL_MS } from './duration';
export type { AccessTokenPayload, PasswordResetTokenPayload, RefreshTokenPayload } from './jwt';
export {
  signAccessToken,
  signPasswordResetToken,
  signRefreshToken,
  verifyAccessToken,
  verifyPasswordResetToken,
  verifyRefreshToken,
} from './jwt';
export { hashPassword, verifyPassword } from './password';
