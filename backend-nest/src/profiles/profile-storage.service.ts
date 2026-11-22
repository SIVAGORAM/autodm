import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class ProfileStorageService {
  private readonly logger = new Logger(ProfileStorageService.name);
  private readonly client = cloudinary;
  private readonly folder: string;
  readonly available: boolean;

  constructor(config: ConfigService) {
    this.folder = config.get<string>('CLOUDINARY_AVATAR_FOLDER', 'heylaunch/avatars');
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME', '');
    const apiKey = config.get<string>('CLOUDINARY_API_KEY', '');
    const apiSecret = config.get<string>('CLOUDINARY_API_SECRET', '');
    this.available = Boolean(cloudName && apiKey && apiSecret);
    if (this.available) this.client.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  }

  createAvatarId(userId: string, nonce: string) {
    if (!this.available) throw new ServiceUnavailableException('Profile photo storage is not configured.');
    return `${this.folder}/${userId}/${nonce}`;
  }

  async upload(publicId: string, body: Buffer): Promise<{ assetId: string; deliveryUrl: string }> {
    this.requireConfigured();
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = this.client.uploader.upload_stream({
        public_id: publicId,
        resource_type: 'image',
        // Keep the uploaded original private while delivering only this pre-generated
        // avatar derivative. Cloudinary authenticated derivatives also need a signed
        // URL, which is not suitable for a public profile image URL.
        type: 'private',
        overwrite: false,
        invalidate: true,
        eager_async: false,
        eager: [{ width: 512, height: 512, crop: 'fill', gravity: 'auto', fetch_format: 'webp', quality: 'auto:good' }],
      }, (error, response) => {
        if (error || !response) reject(error ?? new Error('Cloudinary returned no upload result.'));
        else resolve(response);
      });
      stream.end(body);
    });
    const deliveryUrl = result.eager?.[0]?.secure_url;
    if (!result.public_id || !deliveryUrl) {
      if (result.public_id) await this.remove(result.public_id).catch(() => this.logCleanupFailure());
      throw new ServiceUnavailableException('Cloudinary did not return the prepared avatar image.');
    }
    return { assetId: result.public_id, deliveryUrl };
  }

  async remove(assetId: string) {
    this.requireConfigured();
    const result = await this.client.uploader.destroy(assetId, {
      resource_type: 'image', type: 'private', invalidate: true,
    });
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error('Cloudinary rejected avatar deletion.');
    }
  }

  private requireConfigured() {
    if (!this.available) throw new ServiceUnavailableException('Profile photo storage is not configured.');
  }

  logCleanupFailure() {
    this.logger.warn('A replaced profile image could not be removed from Cloudinary.');
  }
}
