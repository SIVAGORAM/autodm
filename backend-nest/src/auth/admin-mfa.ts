import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function encodeBase32(value: Buffer): string {
  let bits = 0;
  let accumulator = 0;
  let output = '';
  for (const byte of value) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(accumulator >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(accumulator << (5 - bits)) & 31];
  return output;
}

export function decodeBase32(value: string): Buffer {
  const normalized = value.replace(/=+$/g, '').toUpperCase();
  if (!normalized || /[^A-Z2-7]/.test(normalized)) throw new Error('Invalid authenticator secret.');
  let bits = 0;
  let accumulator = 0;
  const output: number[] = [];
  for (const char of normalized) {
    accumulator = (accumulator << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      output.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function totpStep(secret: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30_000);
  for (const step of [current, current - 1, current + 1]) {
    if (step < 0) continue;
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
    const expected = String(binary % 1_000_000).padStart(6, '0');
    const suppliedBytes = Buffer.from(code);
    const expectedBytes = Buffer.from(expected);
    if (timingSafeEqual(suppliedBytes, expectedBytes)) return step;
  }
  return null;
}

export function newTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function newRecoveryCodes(): string[] {
  return Array.from({ length: 10 }, () => {
    const raw = randomBytes(8).toString('hex').toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12)}`;
  });
}

export function recoveryCodeHash(code: string, pepper: string): string {
  return createHmac('sha256', pepper).update(code.replace(/-/g, '').toUpperCase()).digest('hex');
}

export function authenticatorUri(secret: string, email: string): string {
  const label = encodeURIComponent(`HeyLaunch:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=HeyLaunch&algorithm=SHA1&digits=6&period=30`;
}
