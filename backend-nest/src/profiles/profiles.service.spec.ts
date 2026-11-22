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
