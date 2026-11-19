import { createHmac } from 'crypto';
import { verifyMetaSignature } from './signature';

const secret = 'app-secret-123';
const body = Buffer.from(JSON.stringify({ hello: 'world' }));
const good = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

describe('verifyMetaSignature', () => {
  it('accepts a correct signature', () => {
    expect(verifyMetaSignature(body, good, secret)).toBe(true);
  });
  it('rejects a tampered body', () => {
    expect(verifyMetaSignature(Buffer.from('{"hello":"evil"}'), good, secret)).toBe(false);
  });
  it('rejects a wrong secret', () => {
    expect(verifyMetaSignature(body, good, 'other-secret')).toBe(false);
  });
  it('rejects missing or malformed headers', () => {
    expect(verifyMetaSignature(body, undefined, secret)).toBe(false);
    expect(verifyMetaSignature(body, 'md5=abc', secret)).toBe(false);
    expect(verifyMetaSignature(body, '', secret)).toBe(false);
  });
  it('rejects when no app secret is configured', () => {
    expect(verifyMetaSignature(body, good, '')).toBe(false);
  });
});
