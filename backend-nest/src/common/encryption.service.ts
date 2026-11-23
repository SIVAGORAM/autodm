import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { TextDecoder } from 'util';
import CryptoJS from 'crypto-js';

// New token writes use authenticated encryption. Legacy CryptoJS values remain
// readable so deployment does not invalidate already-connected accounts.
@Injectable()
export class EncryptionService {
  private readonly keys: Buffer[];
  private readonly legacyKeys: string[];

  constructor(config: ConfigService) {
    const raw = config.getOrThrow<string>('ENCRYPTION_KEY');
    const fallbackRaw = typeof config.get === 'function' ? (config.get<string>('ENCRYPTION_FALLBACK_KEYS') || '') : '';
    const allKeyStrings = [...raw.split(','), ...fallbackRaw.split(',')].map((k) => k.trim()).filter(Boolean);
    this.legacyKeys = allKeyStrings.length ? allKeyStrings : [raw];
    this.keys = this.legacyKeys.map((k) => createHash('sha256').update(k, 'utf8').digest());
  }

  encrypt(text: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.keys[0], nonce);
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
      const nonce = Buffer.from(parts[1], 'hex');
      const tag = Buffer.from(parts[2], 'hex');
      const data = Buffer.from(parts[3], 'base64url');

      let lastError: Error | null = null;
      for (const key of this.keys) {
        try {
          const decipher = createDecipheriv('aes-256-gcm', key, nonce);
          decipher.setAuthTag(tag);
          const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
          return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
        } catch (err: any) {
          lastError = err;
        }
      }
      throw lastError || new Error('Decryption failed');
    }

    // Backward compatibility for tokens encrypted by the previous Express/Nest
    // release. Reads do not rewrite rows; the next OAuth/token refresh writes v2.
    // Legacy CryptoJS/OpenSSL ciphertext has no authentication tag, so a wrong
    // key can occasionally produce valid UTF-8. Stored legacy values are
    // Instagram access tokens (printable ASCII, at least 16 chars); validate
    // that shape before accepting plaintext. Try rotation fallbacks first,
    // since legacy rows were encrypted with the prior primary key.
    const legacyKeyCandidates = [...this.legacyKeys.slice(1), this.legacyKeys[0]];
    for (const legacyKey of legacyKeyCandidates) {
      try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, legacyKey);
        const text = bytes.toString(CryptoJS.enc.Utf8);
        if (/^[\x21-\x7e]{16,8192}$/.test(text)) return text;
      } catch {}
    }
    throw new Error('Unable to decrypt legacy encrypted value with configured keys');
  }
}
