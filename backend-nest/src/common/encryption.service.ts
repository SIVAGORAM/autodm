import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { TextDecoder } from 'util';
import CryptoJS from 'crypto-js';

// New token writes use authenticated encryption. Legacy CryptoJS values remain
// readable so deployment does not invalidate already-connected accounts.
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;
  private readonly legacyKey: string;
  constructor(config: ConfigService) {
    this.legacyKey = config.getOrThrow<string>('ENCRYPTION_KEY');
    this.key = createHash('sha256').update(this.legacyKey, 'utf8').digest();
  }
  encrypt(text: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v2.${nonce.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('base64url')}`;
  }
  decrypt(ciphertext: string): string {
    if (ciphertext.startsWith('v2.')) {
      const parts = ciphertext.split('.');
      if (parts.length !== 4 || !/^[a-f0-9]{24}$/i.test(parts[1]) || !/^[a-f0-9]{32}$/i.test(parts[2]) || !/^[A-Za-z0-9_-]*$/.test(parts[3])) {
        throw new Error('Invalid encrypted token format');
      }
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(parts[1], 'hex'));
      decipher.setAuthTag(Buffer.from(parts[2], 'hex'));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]);
      return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
    }

    // Backward compatibility for tokens encrypted by the previous Express/Nest
    // release. Reads do not rewrite rows; the next OAuth/token refresh writes v2.
    const bytes = CryptoJS.AES.decrypt(ciphertext, this.legacyKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}
