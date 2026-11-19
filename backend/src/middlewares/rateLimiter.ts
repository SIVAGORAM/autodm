// src/middlewares/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const createLimiter = (windowMs: number, max: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message } },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
    skip: (req: Request) => req.ip === '127.0.0.1',
  });

// Auth endpoints - strict limit
export const authLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  10,             // 10 attempts
  'Too many authentication attempts. Try again in 15 minutes.'
);

// API endpoints - generous limit
export const apiLimiter = createLimiter(
  60 * 1000,  // 1 minute
  100,        // 100 requests
  'Too many requests. Please slow down.'
);

// Webhook - very generous (Instagram sends many events)
export const webhookLimiter = createLimiter(
  60 * 1000,
  500,
  'Webhook rate limit exceeded.'
);

// Campaign creation
export const campaignLimiter = createLimiter(
  60 * 60 * 1000, // 1 hour
  20,
  'Campaign creation limit reached.'
);
