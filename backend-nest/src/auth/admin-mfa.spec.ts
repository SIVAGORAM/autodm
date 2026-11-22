import { createHmac } from 'node:crypto';
import { decodeBase32, encodeBase32, newRecoveryCodes, newTotpSecret, recoveryCodeHash, totpStep } from './admin-mfa';

describe('admin TOTP and recovery primitives', () => {
  it('round-trips base32 and follows RFC 6238 time-step behavior', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(1n);
    const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
    const offset = digest[digest.length - 1] & 15;
    const binary = ((digest[offset] & 127) << 24) | ((digest[offset + 1] & 255) << 16) |
      ((digest[offset + 2] & 255) << 8) | (digest[offset + 3] & 255);
    const code = String(binary % 1_000_000).padStart(6, '0');
    expect(encodeBase32(decodeBase32(secret))).toBe(secret);
    expect(totpStep(secret, code, 30_000)).toBe(1);
    expect(totpStep(secret, 'not-a-code', 30_000)).toBeNull();
    expect(totpStep(secret, '000000', 30_000 + 120_000)).toBeNull();
  });

  it('creates independent recovery codes and stores only keyed hashes', () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((code) => /^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/.test(code))).toBe(true);
    expect(recoveryCodeHash(codes[0], 'pepper')).toBe(recoveryCodeHash(codes[0].replace(/-/g, '').toLowerCase(), 'pepper'));
    expect(recoveryCodeHash(codes[0], 'other-pepper')).not.toBe(recoveryCodeHash(codes[0], 'pepper'));
    expect(newTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });
});
