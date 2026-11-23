import { BadRequestException } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';

describe('ProfilesController avatar upload boundary', () => {
  const profileService = {
    uploadAvatar: jest.fn(),
    removeAvatar: jest.fn(),
  };
  const controller = new ProfilesController(profileService as never);

  beforeEach(() => jest.clearAllMocks());

  it('passes one bounded multipart image to the owner-scoped service', async () => {
    const image = Buffer.from('image-bytes');
    const request = {
      file: jest.fn().mockResolvedValue({
        toBuffer: jest.fn().mockResolvedValue(image),
        file: { truncated: false },
      }),
    };
    profileService.uploadAvatar.mockResolvedValue({ avatarUrl: 'https://images.example/avatar.webp' });

    await expect(controller.uploadAvatar('user-1', request as never)).resolves.toEqual({
      avatarUrl: 'https://images.example/avatar.webp',
    });

    expect(request.file).toHaveBeenCalledWith({ limits: { files: 1, fileSize: 5 * 1024 * 1024 } });
    expect(profileService.uploadAvatar).toHaveBeenCalledWith('user-1', image);
  });

  it('rejects a request without a file', async () => {
    const request = { file: jest.fn().mockResolvedValue(undefined) };

    await expect(controller.uploadAvatar('user-1', request as never))
      .rejects.toThrow(new BadRequestException('Select an image to upload.'));
    expect(profileService.uploadAvatar).not.toHaveBeenCalled();
  });

  it.each([
    ['multipart file limit failure', async () => { throw new Error('too large'); }, false],
    ['buffer read failure', async () => { throw new Error('unavailable'); }, false],
    ['truncated multipart file', async () => Buffer.from('partial'), true],
  ])('rejects a %s before calling the storage service', async (_label, toBuffer, truncated) => {
    const file = { toBuffer, file: { truncated } };
    const request = { file: jest.fn().mockResolvedValue(file) };

    await expect(controller.uploadAvatar('user-1', request as never))
      .rejects.toThrow(new BadRequestException('Choose an image smaller than 5 MB.'));
    expect(profileService.uploadAvatar).not.toHaveBeenCalled();
  });

  it('delegates avatar removal to the authenticated owner service', async () => {
    profileService.removeAvatar.mockResolvedValue({ avatarUrl: null });

    await expect(controller.removeAvatar('user-1')).resolves.toEqual({ avatarUrl: null });
    expect(profileService.removeAvatar).toHaveBeenCalledWith('user-1');
  });
});
