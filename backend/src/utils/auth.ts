// src/utils/auth.ts
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { env } from '../configs/env';
import { v4 as uuidv4 } from 'uuid';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
  jti: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string; // DB row id for rotation
}

// ─── Token generation ──────────────────────────────────────────────
export function generateAccessToken(payload: Omit<AccessTokenPayload, 'jti'>): string {
  return jwt.sign(
    { ...payload, jti: uuidv4() },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      issuer: 'instagram-automation',
      audience: 'web-client',
    }
  );
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(
    payload,
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      issuer: 'instagram-automation',
      audience: 'web-client',
    }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'instagram-automation',
    audience: 'web-client',
  }) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: 'instagram-automation',
    audience: 'web-client',
  }) as RefreshTokenPayload;
}

// ─── Cookie management ─────────────────────────────────────────────
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const isProduction = env.NODE_ENV === 'production';

  // Access token cookie (short-lived, 15m)
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    domain: isProduction ? env.COOKIE_DOMAIN : undefined,
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  });

  // Refresh token cookie (long-lived, 30d, restricted path)
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    domain: isProduction ? env.COOKIE_DOMAIN : undefined,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/api/auth/refresh', // Only sent to refresh endpoint
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, { path: '/' });
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: '/api/auth/refresh' });
}

// ─── Token expiry helpers ──────────────────────────────────────────
export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  return expiry;
}

export function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // default 15min in seconds
  const value = parseInt(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}
