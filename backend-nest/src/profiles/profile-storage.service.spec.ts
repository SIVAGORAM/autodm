import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { ProfileStorageService } from './profile-storage.service';

function config(values: Record<string, string> = {}) {
  return { get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback) } as unknown as ConfigService;
}

describe('ProfileStorageService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does not enable uploads unless all server-side credentials are present', async () => {
    const storage = new ProfileStorageService(config({ CLOUDINARY_CLOUD_NAME: 'creator-cloud' }));

    expect(storage.available).toBe(false);
    await expect(storage.upload('heylaunch/avatars/user/id', Buffer.from('image')))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('stores a private original and pre-generates the public avatar derivative', async () => {
    const configSpy = jest.spyOn(cloudinary, 'config').mockReturnValue(cloudinary);
    const storage = new ProfileStorageService(config({
      CLOUDINARY_CLOUD_NAME: 'creator-cloud', CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret', CLOUDINARY_AVATAR_FOLDER: 'heylaunch/avatars',
    }));
    const response = {
      public_id: 'heylaunch/avatars/user/id',
      eager: [{ secure_url: 'https://res.cloudinary.com/creator-cloud/image/private/c_fill/avatar.webp' }],
    };
    const stream = { end: jest.fn() };
    const uploadSpy = jest.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation(((options: any, callback: any) => {
      expect(options).toMatchObject({
        public_id: 'heylaunch/avatars/user/id', resource_type: 'image', type: 'private', overwrite: false,
        eager_async: false,
        eager: [{ width: 512, height: 512, crop: 'fill', gravity: 'auto', fetch_format: 'webp', quality: 'auto:good' }],
      });
      callback(null, response);
      return stream;
    }) as any);
    const input = Buffer.from('normalized-image');

    await expect(storage.upload('heylaunch/avatars/user/id', input)).resolves.toEqual({
      assetId: response.public_id, deliveryUrl: response.eager[0].secure_url,
    });

    expect(configSpy).toHaveBeenCalledWith({
      cloud_name: 'creator-cloud', api_key: 'test-key', api_secret: 'test-secret', secure: true,
    });
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(stream.end).toHaveBeenCalledWith(input);
  });

  it('removes an unusable upload if Cloudinary did not prepare a derivative', async () => {
    const storage = new ProfileStorageService(config({
      CLOUDINARY_CLOUD_NAME: 'creator-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret',
    }));
    jest.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation(((options: any, callback: any) => {
      callback(null, { public_id: 'heylaunch/avatars/user/id', eager: [] });
      return { end: jest.fn() };
    }) as any);
    const destroySpy = jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' } as any);

    await expect(storage.upload('heylaunch/avatars/user/id', Buffer.from('normalized-image')))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(destroySpy).toHaveBeenCalledWith('heylaunch/avatars/user/id', {
      resource_type: 'image', type: 'private', invalidate: true,
    });
  });

  it('accepts an idempotent deletion result from Cloudinary', async () => {
    const storage = new ProfileStorageService(config({
      CLOUDINARY_CLOUD_NAME: 'creator-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret',
    }));
    const destroySpy = jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'not found' } as any);

    await expect(storage.remove('heylaunch/avatars/user/id')).resolves.toBeUndefined();
    expect(destroySpy).toHaveBeenCalledWith('heylaunch/avatars/user/id', {
      resource_type: 'image', type: 'private', invalidate: true,
    });
  });
});
