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

  it('fails explicitly when no configured key can decrypt a legacy value', () => {
    const oldCiphertext = CryptoJS.AES.encrypt('old-instagram-token', key).toString();
    const wrongKeyService = new EncryptionService({
      getOrThrow: () => 'a-different-test-encryption-key-that-is-long-enough',
    } as any);
    expect(() => wrongKeyService.decrypt(oldCiphertext)).toThrow('Unable to decrypt legacy encrypted value with configured keys');
  });

  it('decrypts old authenticated and legacy values while encrypting new values with the primary key', () => {
    const oldKey = 'old-encryption-key-for-safe-rotation-at-least-32-chars';
    const primaryKey = 'new-encryption-key-for-safe-rotation-at-least-32-chars';
    const oldService = new EncryptionService({ getOrThrow: () => oldKey } as any);
    const rotatingService = new EncryptionService({
      getOrThrow: () => primaryKey,
      get: (name: string) => name === 'ENCRYPTION_FALLBACK_KEYS' ? oldKey : undefined,
    } as any);
    const oldAuthenticated = oldService.encrypt('old-v2-token');
    const oldLegacy = CryptoJS.AES.encrypt('old-legacy-token', oldKey).toString();

    expect(rotatingService.decrypt(oldAuthenticated)).toBe('old-v2-token');
    expect(rotatingService.decrypt(oldLegacy)).toBe('old-legacy-token');
    const newlyEncrypted = rotatingService.encrypt('new-token');
    expect(newlyEncrypted.startsWith('v2.')).toBe(true);
    expect(rotatingService.decrypt(newlyEncrypted)).toBe('new-token');
  });
});
