import CryptoJS from 'crypto-js';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  const key = 'a-long-test-encryption-key-that-is-never-used-in-production';
  const service = new EncryptionService({ getOrThrow: () => key } as any);

  it('round-trips new tokens using a versioned authenticated format', () => {
    const encrypted = service.encrypt('instagram-token-value');
    expect(encrypted.startsWith('v2.')).toBe(true);
    expect(service.decrypt(encrypted)).toBe('instagram-token-value');
  });

  it('rejects tampered authenticated ciphertext', () => {
    const encrypted = service.encrypt('instagram-token-value');
    const parts = encrypted.split('.');
    parts[2] = `${parts[2][0] === '0' ? '1' : '0'}${parts[2].slice(1)}`;
    expect(() => service.decrypt(parts.join('.'))).toThrow();
  });

  it('continues to decrypt legacy CryptoJS token values', () => {
    const legacy = CryptoJS.AES.encrypt('old-instagram-token', key).toString();
    expect(service.decrypt(legacy)).toBe('old-instagram-token');
  });
});
