// src/services/instagram.service.ts
import axios, { AxiosInstance } from 'axios';
import { encryption } from '../utils/encryption';
import { cache } from '../configs/redis';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { AppError } from '../middlewares/errorHandler';

const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';
const FOLLOWER_CACHE_TTL = 3600; // 1 hour

class InstagramService {
  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: GRAPH_API_BASE,
      timeout: 10000,
      params: { access_token: accessToken },
    });
  }

  private async getDecryptedToken(instagramAccountId: string): Promise<string> {
    const cacheKey = `ig_token:${instagramAccountId}`;
    const cached = await cache.get<string>(cacheKey, true);
    if (cached) return cached;


    const account = await prisma.instagramAccount.findUnique({
      where: { id: instagramAccountId },
      select: { accessTokenEnc: true, tokenExpiresAt: true },
    });

    if (!account) throw new AppError('Instagram account not found', 404, 'NOT_FOUND');

    const token = encryption.decrypt(account.accessTokenEnc);
    await cache.set(cacheKey, token, 1800, true); // cache 30m
    return token;

  }

  // ─── Send DM via Instagram API ──────────────────────────────────
  async sendDM(instagramAccountId: string, recipientId: string, message: string): Promise<string> {
    const accessToken = await this.getDecryptedToken(instagramAccountId);
    const client = this.getClient(accessToken);

    try {
      const response = await client.post(`/me/messages`, {
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: 'RESPONSE',
      });

      return response.data.message_id;
    } catch (error: any) {
      const fbError = error.response?.data?.error;
      const errorCode = fbError?.code;

      // Instagram API error codes
      if (errorCode === 190) throw new AppError('Instagram token expired', 401, 'IG_TOKEN_EXPIRED');
      if (errorCode === 10) throw new AppError('Permission denied', 403, 'IG_PERMISSION_DENIED');
      if (errorCode === 100) throw new AppError('Invalid parameter', 400, 'IG_INVALID_PARAM');
      if (errorCode === 32 || errorCode === 613) {
        throw new AppError('Instagram rate limit hit', 429, 'IG_RATE_LIMIT');
      }

      logger.error('Instagram DM error:', { errorCode, fbError, recipientId });
      throw new AppError(`DM failed: ${fbError?.message || 'Unknown error'}`, 500, 'IG_DM_FAILED');
    }
  }

  // ─── Check if user is a follower ────────────────────────────────
  async isFollower(instagramAccountId: string, checkUserId: string): Promise<boolean> {
    const cacheKey = `follower:${instagramAccountId}:${checkUserId}`;

    // Check Redis cache first
    const cached = await cache.get<{ isFollower: boolean }>(cacheKey, true);
    if (cached !== null) return cached.isFollower;


    // Check DB follower cache
    const dbCache = await prisma.followerCache.findUnique({
      where: { instagramAccountId_followerId: { instagramAccountId, followerId: checkUserId } },
    });

    if (dbCache && dbCache.expiresAt > new Date()) {
      await cache.set(cacheKey, { isFollower: dbCache.isFollower }, FOLLOWER_CACHE_TTL, true);
      return dbCache.isFollower;
    }


    // Call Instagram API
    try {
      const accessToken = await this.getDecryptedToken(instagramAccountId);
      const client = this.getClient(accessToken);

      const account = await prisma.instagramAccount.findUnique({
        where: { id: instagramAccountId },
        select: { instagramUserId: true },
      });

      const response = await client.get(
        `/${account!.instagramUserId}/followers`,
        { params: { user_id: checkUserId } }
      );

      const isFollower = response.data.data?.some((f: any) => f.id === checkUserId) ?? false;

      // Upsert DB cache
      const expiresAt = new Date(Date.now() + FOLLOWER_CACHE_TTL * 1000);
      await prisma.followerCache.upsert({
        where: { instagramAccountId_followerId: { instagramAccountId, followerId: checkUserId } },
        update: { isFollower, cachedAt: new Date(), expiresAt },
        create: { instagramAccountId, followerId: checkUserId, isFollower, expiresAt },
      });

      // Redis cache
      await cache.set(cacheKey, { isFollower }, FOLLOWER_CACHE_TTL, true);
      return isFollower;

    } catch (error: any) {
      logger.warn('Follower check failed, defaulting to false:', error.message);
      return false;
    }
  }

  // ─── Exchange code for long-lived token ─────────────────────────
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<{ accessToken: string; userId: string; username: string }> {
    const { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET } = process.env;

    // Step 1: Get short-lived token
    const shortLivedResponse = await axios.post('https://api.instagram.com/oauth/access_token', {
      client_id: INSTAGRAM_APP_ID,
      client_secret: INSTAGRAM_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const { access_token: shortToken, user_id: userId } = shortLivedResponse.data;

    // Step 2: Exchange for long-lived token (60 days)
    const longLivedResponse = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret: INSTAGRAM_APP_SECRET,
        access_token: shortToken,
      },
    });

    const { access_token: longToken } = longLivedResponse.data;

    // Get username
    const profileResponse = await axios.get(`${GRAPH_API_BASE}/${userId}`, {
      params: { fields: 'username', access_token: longToken },
    });

    return { accessToken: longToken, userId: String(userId), username: profileResponse.data.username };
  }

  // ─── Refresh long-lived token (before expiry) ───────────────────
  async refreshLongLivedToken(instagramAccountId: string): Promise<void> {
    const account = await prisma.instagramAccount.findUnique({ where: { id: instagramAccountId } });
    if (!account) return;

    const currentToken = encryption.decrypt(account.accessTokenEnc);
    const response = await axios.get(`${GRAPH_API_BASE}/refresh_access_token`, {
      params: { grant_type: 'ig_refresh_token', access_token: currentToken },
    });

    const newToken = response.data.access_token;
    const expiresIn = response.data.expires_in; // in seconds
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    await prisma.instagramAccount.update({
      where: { id: instagramAccountId },
      data: { accessTokenEnc: encryption.encrypt(newToken), tokenExpiresAt },
    });

    await cache.del(`ig_token:${instagramAccountId}`);
  }

  // ─── Get account media (posts/reels) ────────────────────────────
  async getMedia(instagramAccountId: string): Promise<any[]> {
    const accessToken = await this.getDecryptedToken(instagramAccountId);
    const client = this.getClient(accessToken);

    const response = await client.get('/me/media', {
      params: { fields: 'id,media_type,caption,permalink,timestamp', limit: 50 },
    });

    return response.data.data || [];
  }
}

export const instagramService = new InstagramService();
