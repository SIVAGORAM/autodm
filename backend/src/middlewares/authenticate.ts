// src/middlewares/authenticate.ts
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, COOKIE_NAMES, AccessTokenPayload } from '../utils/auth';
import { AppError } from './errorHandler';
import { cache } from '../configs/redis';

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Get token from cookie first, then Authorization header (fallback for mobile/API)
    let token = req.cookies[COOKIE_NAMES.ACCESS_TOKEN];

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const payload = verifyAccessToken(token);

    // Check if token is blacklisted (for logout)
    const isBlacklisted = await cache.exists(`blacklist:${payload.jti}`);
    if (isBlacklisted) {
      throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
    }

    req.user = payload;
    next();
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else if (error.name === 'JsonWebTokenError') {
      next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    } else if (error.name === 'TokenExpiredError') {
      next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
    } else {
      next(new AppError('Authentication failed', 401, 'AUTH_FAILED'));
    }
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }
    next();
  };
}
