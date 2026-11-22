import { createHmac } from 'node:crypto';
import { metaScopedUserId, verifyMetaSignedRequest } from './meta-signed-request';

const secret = 'app-secret-for-tests';

function signClaims(claims: Record<string, unknown>, signingSecret = secret) {
  const payload = Buffer.from(JSON.stringify({ issued_at: Math.floor(Date.now() / 1000), ...claims })).toString('base64url');
  const signature = createHmac('sha256', signingSecret).update(payload).digest('base64url');
  return `${signature}.${payload}`;
}

describe('Meta signed_request verifier', () => {
  it('verifies HMAC-SHA256 and returns claims', () => {
    const signed = signClaims({ algorithm: 'HMAC-SHA256', user_id: '123456789' });
    const claims = verifyMetaSignedRequest(signed, secret);
    expect(claims).toEqual({ issued_at: expect.any(Number), algorithm: 'HMAC-SHA256', user_id: '123456789' });
    expect(metaScopedUserId(claims!)).toBe('123456789');
  });

  it('rejects altered payloads, wrong secrets, unsupported algorithms, and oversized requests', () => {
    const signed = signClaims({ algorithm: 'HMAC-SHA256', user_id: '123456789' });
    const [signature, payload] = signed.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '987654321' })).toString('base64url');
    expect(verifyMetaSignedRequest(`${signature}.${tamperedPayload}`, secret)).toBeNull();
    expect(verifyMetaSignedRequest(signed, 'different-secret')).toBeNull();
    expect(verifyMetaSignedRequest(signClaims({ algorithm: 'none', user_id: '123' }), secret)).toBeNull();
    expect(verifyMetaSignedRequest(signClaims({ algorithm: 'HMAC-SHA256', user_id: '123', issued_at: 1 }), secret)).toBeNull();
    expect(verifyMetaSignedRequest(signClaims({ algorithm: 'HMAC-SHA256', user_id: '123', issued_at: Math.floor(Date.now() / 1000) + 3600 }), secret)).toBeNull();
    expect(verifyMetaSignedRequest(`${signature}.${payload}`, '')).toBeNull();
    expect(verifyMetaSignedRequest('a'.repeat(16 * 1024 + 1), secret)).toBeNull();
  });

  it('accepts only valid numeric Instagram-scoped user IDs', () => {
    expect(metaScopedUserId({ user_id: 123 })).toBe('123');
    expect(metaScopedUserId({ user_id: '123' })).toBe('123');
    expect(metaScopedUserId({ user_id: '1.23' })).toBeNull();
    expect(metaScopedUserId({ user_id: 'user-123' })).toBeNull();
    expect(metaScopedUserId({ user_id: Number.MAX_SAFE_INTEGER + 1 })).toBeNull();
  });
});
