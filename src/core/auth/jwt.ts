import jwt, { SignOptions } from 'jsonwebtoken';

import { env } from '../config';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  tokenVersion: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  familyId: string;
  tokenVersion: number;
}

export interface PasswordResetTokenPayload {
  sub: string;
  jti: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    algorithm: env.JWT_ALGORITHM,
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: [env.JWT_ALGORITHM],
  }) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const options: SignOptions = {
    algorithm: env.JWT_ALGORITHM,
    expiresIn: env.REFRESH_TOKEN_TTL as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: [env.JWT_ALGORITHM],
  }) as RefreshTokenPayload;
}

export function signPasswordResetToken(payload: PasswordResetTokenPayload): string {
  const options: SignOptions = {
    algorithm: env.JWT_ALGORITHM,
    expiresIn: '30m',
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyPasswordResetToken(token: string): PasswordResetTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: [env.JWT_ALGORITHM],
  }) as PasswordResetTokenPayload;
}
