// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  generateAccessToken, generateRefreshToken,
  verifyRefreshToken, setAuthCookies, clearAuthCookies,
  getRefreshTokenExpiry, COOKIE_NAMES,
} from '../utils/auth';
import { cache } from '../configs/redis';
import { AppError } from '../middlewares/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import { mailer } from '../utils/mailer';
import crypto from 'crypto';

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const authController = {
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password } = signupSchema.parse(req.body);

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // Generate 6-digit OTP code for verification
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      const user = await prisma.user.create({
        data: { name, email, passwordHash, otpCode, otpExpires },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });

      // Send Verification Email
      await mailer.sendVerificationEmail(user.email, otpCode);

      const tokenId = uuidv4();
      const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
      const refreshToken = generateRefreshToken({ userId: user.id, tokenId });

      await prisma.refreshToken.create({
        data: { id: tokenId, token: refreshToken, userId: user.id, expiresAt: getRefreshTokenExpiry() },
      });

      setAuthCookies(res, accessToken, refreshToken);

      res.status(201).json({ success: true, data: { user, accessToken } });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({ where: { email } });

      // Constant-time comparison to prevent timing attacks
      const passwordValid = user
        ? await bcrypt.compare(password, user.passwordHash)
        : await bcrypt.compare(password, '$2a$12$placeholder.hash.for.timing.attack.prevention');

      if (!user || !passwordValid) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      const tokenId = uuidv4();
      const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
      const refreshToken = generateRefreshToken({ userId: user.id, tokenId });

      await prisma.refreshToken.create({
        data: { id: tokenId, token: refreshToken, userId: user.id, expiresAt: getRefreshTokenExpiry() },
      });

      setAuthCookies(res, accessToken, refreshToken);

      const userData = { id: user.id, name: user.name, email: user.email, role: user.role, isVerified: user.isVerified };
      res.json({ success: true, data: { user: userData, accessToken } });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies[COOKIE_NAMES.REFRESH_TOKEN];
      if (!token) throw new AppError('No refresh token', 401, 'UNAUTHORIZED');

      const payload = verifyRefreshToken(token);

      const storedToken = await prisma.refreshToken.findUnique({
        where: { id: payload.tokenId },
        include: { user: { select: { id: true, email: true, role: true } } },
      });

      if (!storedToken || storedToken.token !== token) {
        // Token reuse detected - invalidate all tokens for this user
        await prisma.refreshToken.deleteMany({ where: { userId: payload.userId } });
        clearAuthCookies(res);
        throw new AppError('Token reuse detected', 401, 'TOKEN_REUSE');
      }

      if (storedToken.expiresAt < new Date()) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new AppError('Refresh token expired', 401, 'TOKEN_EXPIRED');
      }

      // Rotate: delete old, issue new
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });

      const user = storedToken.user;
      const newTokenId = uuidv4();
      const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
      const refreshToken = generateRefreshToken({ userId: user.id, tokenId: newTokenId });

      await prisma.refreshToken.create({
        data: { id: newTokenId, token: refreshToken, userId: user.id, expiresAt: getRefreshTokenExpiry() },
      });

      setAuthCookies(res, accessToken, refreshToken);
      res.json({ success: true, data: { accessToken } });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies[COOKIE_NAMES.REFRESH_TOKEN];

      if (token) {
        try {
          const payload = verifyRefreshToken(token);
          await prisma.refreshToken.deleteMany({ where: { id: payload.tokenId } });
        } catch { /* expired token is fine */ }
      }

      // Blacklist the access token JTI until it expires
      if (req.user?.jti) {
        await cache.set(`blacklist:${req.user.jti}`, '1', 15 * 60);
      }

      clearAuthCookies(res);
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: {
          id: true, name: true, email: true, role: true, isVerified: true,
          createdAt: true,
          instagramAccount: {
            select: { id: true, username: true, isActive: true }
          },
          subscription: {
            select: { status: true, currentPeriodEnd: true, plan: { select: { name: true, dmLimit: true, campaignLimit: true } } }
          }
        },
      });

      if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
      res.json({ success: true, data: { user } });
    } catch (err) { next(err); }
  },

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      
      if (!user || user.otpCode !== code || (user.otpExpires && user.otpExpires < new Date())) {
        throw new AppError('Invalid or expired OTP code', 400, 'INVALID_OTP');
      }

      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { isVerified: true, otpCode: null, otpExpires: null }
      });

      res.json({ success: true, message: 'Account verified successfully' });
    } catch (err) { next(err); }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.json({ success: true, message: 'If credentials match, reset link is sent.' });

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1-hour expiration

      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: resetTokenHash, otpExpires: resetExpires }
      });

      await mailer.sendResetPasswordEmail(user.email, resetToken);
      res.json({ success: true, message: 'Reset link sent successfully' });
    } catch (err) { next(err); }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const user = await prisma.user.findFirst({
        where: { otpCode: tokenHash, otpExpires: { gt: new Date() } }
      });
      if (!user) throw new AppError('Invalid or expired reset token', 400, 'INVALID_TOKEN');

      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, otpCode: null, otpExpires: null }
      });

      res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) { next(err); }
  }
};
