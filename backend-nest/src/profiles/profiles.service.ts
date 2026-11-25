import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, Logger,
  NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import sharp, { Metadata } from 'sharp';
import { Prisma, ProfileAppearance, ProfileLinkKind, PublicProfileVisibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileStorageService } from './profile-storage.service';
import { UpdatePublicProfileInput } from './profiles.dto';

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
const RESERVED = new Set([
  'admin', 'api', 'login', 'signup', 'dashboard', 'settings', 'billing', 'support', 'help',
  'privacy', 'terms', 'refunds', 'contact', 'legal', 'robots', 'sitemap', 'favicon', 'manifest',
  'verify', 'forgot-password', 'reset-password', 'opengraph-image', 'icon', 'instagram', 'automation', 'automations',
  'contacts', 'profile', 'landing', 'fonts', 'u', 'heylaunch', 'www', 'null', 'undefined',
]);
const SOCIAL_HOSTS: Record<string, string[]> = {
  instagram: ['instagram.com'], youtube: ['youtube.com', 'youtu.be'], linkedin: ['linkedin.com'],
  x: ['x.com', 'twitter.com'], facebook: ['facebook.com', 'fb.com'], tiktok: ['tiktok.com'],
  github: ['github.com'], whatsapp: ['wa.me', 'whatsapp.com'], telegram: ['t.me', 'telegram.me'],
  pinterest: ['pinterest.com', 'pin.it'],
};
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_PIXELS = 20_000_000;
const USERNAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(private readonly prisma: PrismaService, private readonly storage: ProfileStorageService) {}

  private normalize(username: string) { return username.trim().toLowerCase(); }

  private validateUsername(username: string) {
    if (!USERNAME_PATTERN.test(username)) return 'invalid';
    if (RESERVED.has(username)) return 'reserved';
    return null;
  }

  private validateSocialHost(platform: string, rawUrl: string) {
    const domains = SOCIAL_HOSTS[platform];
    if (!domains) return true;
    const host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  }

  async usernameAvailability(userId: string, input: string) {
    const username = this.normalize(input);
    const invalid = this.validateUsername(username);
    if (invalid) return { username, available: false, reason: invalid };

    const found = await this.prisma.profileHandle.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { profileId: true, isCurrent: true, profile: { select: { userId: true } } },
    });
    const availableToOwner = found?.profile.userId === userId && found.isCurrent;
    return {
      username,
      available: !found || availableToOwner,
      reason: !found || availableToOwner ? null : found.profile.userId === userId ? 'previously_used' : 'taken',
    };
  }

  async getOwnerProfile(userId: string) {
    const profile = await this.prisma.publicProfile.findUnique({
      where: { userId },
      include: {
        currentHandle: { select: { username: true } },
        links: { orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!profile) return { profile: null, avatarStorageAvailable: true };
    return {
      profile: {
        id: profile.id,
        username: profile.currentHandle?.username ?? '',
        displayName: profile.displayName,
        bio: profile.bio ?? '',
        visibility: profile.visibility,
        appearance: profile.appearance,
        avatarUrl: profile.avatarDeliveryUrl,
        socialLinks: profile.links.filter((link) => link.kind === 'SOCIAL').map((link) => this.serializeLink(link)),
        customLinks: profile.links.filter((link) => link.kind === 'CUSTOM').map((link) => this.serializeLink(link)),
        updatedAt: profile.updatedAt,
      },
      avatarStorageAvailable: true,
    };
  }

  private serializeLink(link: {
    kind: ProfileLinkKind;
    id: string; platform: string | null; title: string; url: string; description: string | null;
    sortOrder: number; isVisible: boolean;
  }) {
    return { id: link.id, kind: link.kind, platform: link.platform, title: link.title, url: link.url,
      description: link.description, sortOrder: link.sortOrder, isVisible: link.isVisible };
  }

  async saveProfile(userId: string, input: UpdatePublicProfileInput) {
    const username = this.normalize(input.username);
    const invalid = this.validateUsername(username);
    if (invalid === 'reserved') throw new BadRequestException('That username is reserved.');
    if (invalid) throw new BadRequestException('Username must be 3–30 lowercase letters, numbers, or underscores.');
    for (const link of input.socialLinks) {
      if (!this.validateSocialHost(link.platform, link.url)) {
        throw new BadRequestException(`Enter a valid ${link.platform} profile URL.`);
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const owner = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, role: true, suspendedAt: true, deletionRequestedAt: true },
        });
        if (!owner || owner.role !== 'INFLUENCER' || owner.suspendedAt || owner.deletionRequestedAt) {
          throw new NotFoundException('An active creator account is required.');
        }

        const existing = await tx.publicProfile.findUnique({
          where: { userId }, include: { currentHandle: true },
        });
        if (existing?.moderationBlockedAt && input.visibility === 'PUBLIC') {
          throw new ForbiddenException('This profile is restricted while it is reviewed by HeyLaunch. Contact support if you believe this is a mistake.');
        }
        const handle = await tx.profileHandle.findFirst({
          where: { username: { equals: username, mode: 'insensitive' } },
          select: { id: true, profileId: true, isCurrent: true },
        });
        const requestedIsCurrent = !!existing?.currentHandle && existing.currentHandle.username === username;
        if (handle && !(handle.profileId === existing?.id && handle.isCurrent && requestedIsCurrent)) {
          throw new ConflictException(handle.profileId === existing?.id
            ? 'A previous username cannot be reused.' : 'That username is already taken.');
        }

        const now = new Date();
        if (existing?.currentHandle && !requestedIsCurrent) {
          const lastChange = await tx.profileHandle.findFirst({
            where: { profileId: existing.id, isCurrent: false, retiredAt: { not: null } },
            orderBy: { retiredAt: 'desc' }, select: { retiredAt: true },
          });
          if (lastChange?.retiredAt && now.getTime() - lastChange.retiredAt.getTime() < USERNAME_CHANGE_COOLDOWN_MS) {
            throw new ConflictException('Usernames can be changed once every 30 days.');
          }
        }

        const profile = existing
          ? await tx.publicProfile.update({
            where: { id: existing.id },
            data: { displayName: input.displayName, bio: input.bio, visibility: input.visibility as PublicProfileVisibility,
              appearance: input.appearance as ProfileAppearance },
          })
          : await tx.publicProfile.create({
            data: { userId, displayName: input.displayName, bio: input.bio,
              visibility: input.visibility as PublicProfileVisibility, appearance: input.appearance as ProfileAppearance },
          });

        if (!existing?.currentHandle || !requestedIsCurrent) {
          if (existing?.currentHandle) {
            await tx.profileHandle.update({ where: { id: existing.currentHandle.id }, data: { isCurrent: false, retiredAt: now } });
          }
          const nextHandle = await tx.profileHandle.create({ data: { profileId: profile.id, username, isCurrent: true } });
          await tx.publicProfile.update({ where: { id: profile.id }, data: { currentHandleId: nextHandle.id } });
        }

        await tx.profileLink.deleteMany({ where: { profileId: profile.id } });
        const links = [
          ...input.socialLinks.map((link) => ({ profileId: profile.id, kind: ProfileLinkKind.SOCIAL,
            platform: link.platform, title: link.title, url: new URL(link.url).toString(), description: null,
            sortOrder: link.sortOrder, isVisible: link.isVisible })),
          ...input.customLinks.map((link) => ({ profileId: profile.id, kind: ProfileLinkKind.CUSTOM,
            platform: null, title: link.title, url: new URL(link.url).toString(), description: link.description,
            sortOrder: link.sortOrder, isVisible: link.isVisible })),
        ];
        if (links.length) await tx.profileLink.createMany({ data: links });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That username is already taken.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('The profile changed at the same time. Please retry.');
      }
      throw error;
    }
    return this.getOwnerProfile(userId);
  }

  async getPublicProfile(inputUsername: string) {
    const username = this.normalize(inputUsername);
    const found = await this.prisma.profileHandle.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      include: {
        profile: {
          include: {
            currentHandle: { select: { username: true } },
            user: { select: { suspendedAt: true, deletionRequestedAt: true, role: true } },
            links: { where: { isVisible: true }, orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] },
          },
        },
      },
    });
    if (!found || !found.profile || found.profile.visibility !== 'PUBLIC'
      || found.profile.user.role !== 'INFLUENCER' || found.profile.user.suspendedAt
      || found.profile.user.deletionRequestedAt) {
      throw new NotFoundException('Profile not found.');
    }
    if (!found.isCurrent) {
      return { redirectTo: found.profile.currentHandle?.username ?? null };
    }
    return {
      username: found.username,
      displayName: found.profile.displayName,
      bio: found.profile.bio,
      appearance: found.profile.appearance,
      avatarUrl: found.profile.avatarDeliveryUrl,
      links: found.profile.links.map((link) => this.serializeLink(link)),
    };
  }

  async uploadAvatar(userId: string, input: Buffer) {
    if (!input.length || input.length > MAX_AVATAR_BYTES) throw new BadRequestException('Choose an image smaller than 5 MB.');
    const profile = await this.prisma.publicProfile.findUnique({
      where: { userId },
      select: { id: true, user: { select: { role: true, suspendedAt: true, deletionRequestedAt: true } } },
    });
    if (!profile || profile.user.role !== 'INFLUENCER' || profile.user.suspendedAt || profile.user.deletionRequestedAt) {
      throw new BadRequestException('Save an active creator profile before uploading a photo.');
    }

    let metadata: Metadata;
    let normalized: Buffer;
    try {
      const image = sharp(input, { limitInputPixels: MAX_AVATAR_PIXELS, failOn: 'error' });
      metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || !metadata.width || !metadata.height
        || metadata.width > 4096 || metadata.height > 4096 || metadata.width * metadata.height > MAX_AVATAR_PIXELS) {
        throw new BadRequestException('Use a valid JPEG, PNG, or WebP image up to 4096×4096 pixels.');
      }
      normalized = await image.rotate().resize(512, 512, { fit: 'cover', position: 'attention', withoutEnlargement: true })
        .webp({ quality: 84, effort: 4 }).toBuffer();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('The selected file is not a valid supported image.');
    }

    let uploaded: { assetId: string; deliveryUrl: string };
    if (this.storage.available) {
      const publicId = this.storage.createAvatarId(userId, randomUUID());
      uploaded = await this.storage.upload(publicId, normalized);
    } else {
      const base64 = `data:image/webp;base64,${normalized.toString('base64')}`;
      uploaded = { assetId: `db:${userId}:${randomUUID()}`, deliveryUrl: base64 };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.publicProfile.findUnique({ where: { userId }, select: { avatarAssetId: true } });
        const owner = await tx.user.findUnique({ where: { id: userId }, select: { role: true, suspendedAt: true, deletionRequestedAt: true } });
        if (!current || !owner || owner.role !== 'INFLUENCER' || owner.suspendedAt || owner.deletionRequestedAt) {
          throw new NotFoundException('An active creator profile is required.');
        }
        await tx.publicProfile.update({ where: { userId }, data: { avatarAssetId: uploaded.assetId, avatarDeliveryUrl: uploaded.deliveryUrl } });
        if (current.avatarAssetId && current.avatarAssetId !== uploaded.assetId && !current.avatarAssetId.startsWith('db:')) {
          await tx.profileAssetDeletion.upsert({
            where: { assetId: current.avatarAssetId },
            create: { assetId: current.avatarAssetId },
            update: { nextAttemptAt: new Date() },
          });
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!uploaded.assetId.startsWith('db:')) {
        try { await this.storage.remove(uploaded.assetId); } catch {
          await this.enqueueAssetDeletion(uploaded.assetId).catch(() => undefined);
          this.storage.logCleanupFailure();
        }
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('The profile changed while the photo was uploading. Please retry.');
      }
      throw error;
    }
    return this.getOwnerProfile(userId);
  }

  async removeAvatar(userId: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const profile = await tx.publicProfile.findUnique({ where: { userId }, select: { avatarAssetId: true } });
        if (!profile) throw new NotFoundException('Public profile not found.');
        await tx.publicProfile.update({ where: { userId }, data: { avatarAssetId: null, avatarDeliveryUrl: null } });
        if (profile.avatarAssetId && !profile.avatarAssetId.startsWith('db:')) await tx.profileAssetDeletion.upsert({
          where: { assetId: profile.avatarAssetId },
          create: { assetId: profile.avatarAssetId },
          update: { nextAttemptAt: new Date() },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('The profile changed while removing the photo. Please retry.');
      }
      throw error;
    }
    return this.getOwnerProfile(userId);
  }

  private enqueueAssetDeletion(assetId: string) {
    return this.prisma.profileAssetDeletion.upsert({
      where: { assetId }, create: { assetId }, update: { nextAttemptAt: new Date() },
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processAssetDeletions() {
    if (!this.storage.available) return;
    const pending = await this.prisma.profileAssetDeletion.findMany({
      where: { nextAttemptAt: { lte: new Date() } },
      orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    });
    for (const asset of pending) {
      try {
        await this.storage.remove(asset.assetId);
        await this.prisma.profileAssetDeletion.deleteMany({ where: { id: asset.id } });
      } catch {
        const attempts = asset.attempts + 1;
        const delayMs = Math.min(24 * 60 * 60_000, 60_000 * (2 ** Math.min(attempts, 10)));
        await this.prisma.profileAssetDeletion.updateMany({
          where: { id: asset.id },
          data: { attempts, nextAttemptAt: new Date(Date.now() + delayMs) },
        });
        this.storage.logCleanupFailure();
      }
    }
  }
}
