import sharp from 'sharp';
import { Prisma } from '@prisma/client';
import { ProfilesService } from './profiles.service';

describe('ProfilesService asset consistency', () => {
  const activeCreator = { role: 'INFLUENCER', suspendedAt: null, deletionRequestedAt: null };

  function makeService(currentAssetId: string | null) {
    const tx = {
      publicProfile: {
        findUnique: jest.fn().mockResolvedValue({ avatarAssetId: currentAssetId }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn().mockResolvedValue(activeCreator) },
      profileAssetDeletion: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      publicProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'profile', user: activeCreator }) },
      profileHandle: { findFirst: jest.fn() },
      $transaction: jest.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const storage = {
      available: true,
      createAvatarId: jest.fn(() => 'heylaunch/avatars/user/new'),
      upload: jest.fn().mockResolvedValue({ assetId: 'heylaunch/avatars/user/new', deliveryUrl: 'https://res.cloudinary.com/c/image/private/avatar.webp' }),
      remove: jest.fn().mockResolvedValue(undefined),
      logCleanupFailure: jest.fn(),
    };
    const service = new ProfilesService(prisma as never, storage as never);
    jest.spyOn(service, 'getOwnerProfile').mockResolvedValue({ profile: { username: 'creator' }, avatarStorageAvailable: true } as never);
    return { service, prisma, tx, storage };
  }

  it('reads the displaced asset inside a serializable transaction before queuing cleanup', async () => {
    const { service, prisma, tx } = makeService('heylaunch/avatars/user/old');
    const input = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } }).png().toBuffer();

    await service.uploadAvatar('user', input);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(tx.profileAssetDeletion.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { assetId: 'heylaunch/avatars/user/old' },
    }));
  });

  it('clears the current asset and queues its cleanup in one serializable transaction', async () => {
    const { service, prisma, tx } = makeService('heylaunch/avatars/user/current');

    await service.removeAvatar('user');

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(tx.publicProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { avatarAssetId: null, avatarDeliveryUrl: null },
    }));
    expect(tx.profileAssetDeletion.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { assetId: 'heylaunch/avatars/user/current' },
    }));
  });
});

describe('ProfilesService username routing', () => {
  it('reserves current top-level application and metadata routes', async () => {
    const prisma = { profileHandle: { findFirst: jest.fn() } };
    const service = new ProfilesService(prisma as never, { available: false } as never);

    for (const username of ['refunds', 'icon']) {
      await expect(service.usernameAvailability('user-1', username)).resolves.toEqual({
        username, available: false, reason: 'reserved',
      });
    }
    await expect(service.usernameAvailability('user-1', 'opengraph-image')).resolves.toEqual({
      username: 'opengraph-image', available: false, reason: 'invalid',
    });

    expect(prisma.profileHandle.findFirst).not.toHaveBeenCalled();
  });
});

describe('ProfilesService public profile privacy', () => {
  const visibleLink = {
    id: 'link-1', kind: 'CUSTOM', platform: null, title: 'Portfolio', url: 'https://creator.example.com',
    description: null, sortOrder: 0, isVisible: true,
  };
  const visibleProfile = {
    visibility: 'PUBLIC',
    user: { role: 'INFLUENCER', suspendedAt: null, deletionRequestedAt: null },
    currentHandle: { username: 'creator' },
    displayName: 'Creator', bio: 'A short bio', appearance: 'LIGHT',
    avatarDeliveryUrl: 'https://images.example.com/avatar.webp',
    links: [visibleLink],
  };

  function makeService(profile: unknown) {
    const prisma = { profileHandle: { findFirst: jest.fn().mockResolvedValue(profile) } };
    return { service: new ProfilesService(prisma as never, { available: false } as never), prisma };
  }

  it('returns only public display data and visible links for an active creator', async () => {
    const { service, prisma } = makeService({ username: 'creator', isCurrent: true, profile: visibleProfile });

    await expect(service.getPublicProfile('Creator')).resolves.toEqual({
      username: 'creator', displayName: 'Creator', bio: 'A short bio', appearance: 'LIGHT',
      avatarUrl: 'https://images.example.com/avatar.webp', links: [visibleLink],
    });
    expect(prisma.profileHandle.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { username: { equals: 'creator', mode: 'insensitive' } },
      include: expect.objectContaining({
        profile: expect.objectContaining({
          include: expect.objectContaining({
            user: { select: { suspendedAt: true, deletionRequestedAt: true, role: true } },
            links: expect.objectContaining({ where: { isVisible: true } }),
          }),
        }),
      }),
    }));
  });

  it.each([
    ['private profile', { ...visibleProfile, visibility: 'PRIVATE' }],
    ['suspended creator', { ...visibleProfile, user: { ...visibleProfile.user, suspendedAt: new Date() } }],
    ['creator requesting deletion', { ...visibleProfile, user: { ...visibleProfile.user, deletionRequestedAt: new Date() } }],
    ['non-creator account', { ...visibleProfile, user: { ...visibleProfile.user, role: 'USER' } }],
  ])('does not expose a %s', async (_label, profile) => {
    const { service } = makeService({ username: 'creator', isCurrent: true, profile });

    await expect(service.getPublicProfile('creator')).rejects.toThrow('Profile not found.');
  });

  it('returns a retired-handle redirect only while the profile remains public', async () => {
    const { service } = makeService({
      username: 'old_name', isCurrent: false,
      profile: { ...visibleProfile, currentHandle: { username: 'new_name' } },
    });

    await expect(service.getPublicProfile('old_name')).resolves.toEqual({ redirectTo: 'new_name' });

    const { service: privateService } = makeService({
      username: 'old_name', isCurrent: false,
      profile: { ...visibleProfile, visibility: 'PRIVATE', currentHandle: { username: 'new_name' } },
    });
    await expect(privateService.getPublicProfile('old_name')).rejects.toThrow('Profile not found.');
  });
});
