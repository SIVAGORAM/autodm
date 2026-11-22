import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_SIGNED_REQUEST_LENGTH = 16 * 1024;
const MAX_SIGNED_REQUEST_AGE_SECONDS = 24 * 60 * 60;
const MAX_FUTURE_CLOCK_SKEW_SECONDS = 5 * 60;

/** Verify Meta's `signature.payload` HMAC-SHA256 signed_request format. */
export function verifyMetaSignedRequest(signedRequest: string, appSecret: string): Record<string, unknown> | null {
  if (!appSecret || typeof signedRequest !== 'string' || signedRequest.length > MAX_SIGNED_REQUEST_LENGTH) return null;
  const parts = signedRequest.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [encodedSignature, encodedPayload] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(encodedSignature) || !/^[A-Za-z0-9_-]+$/.test(encodedPayload)) return null;

  let signature: Buffer;
  let payload: unknown;
  try {
    signature = Buffer.from(encodedSignature, 'base64url');
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (signature.length !== 32 || !payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const claims = payload as Record<string, unknown>;
  if (typeof claims.algorithm !== 'string' || claims.algorithm.toUpperCase() !== 'HMAC-SHA256') return null;
  const issuedAt = claims.issued_at;
  if (typeof issuedAt !== 'number' || !Number.isSafeInteger(issuedAt) || issuedAt <= 0) return null;
  const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
  if (ageSeconds > MAX_SIGNED_REQUEST_AGE_SECONDS || ageSeconds < -MAX_FUTURE_CLOCK_SKEW_SECONDS) return null;

  const expected = createHmac('sha256', appSecret).update(encodedPayload).digest();
  if (expected.length !== signature.length || !timingSafeEqual(expected, signature)) return null;
  return claims;
}

export function metaScopedUserId(claims: Record<string, unknown>): string | null {
  const value = claims.user_id;
  if (typeof value === 'string' && /^\d{1,30}$/.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  return null;
}
