import { isForbiddenMutationOrigin } from './origin-policy';

describe('browser mutation origin policy', () => {
  const allowed = ['https://app.example.com'];

  it('rejects a cross-site form mutation', () => {
    expect(isForbiddenMutationOrigin('POST', '/api/users/profile', 'https://attacker.example', allowed)).toBe(true);
  });

  it('allows the configured app origin and non-mutating methods', () => {
    expect(isForbiddenMutationOrigin('PATCH', '/api/users/profile', 'https://app.example.com', allowed)).toBe(false);
    expect(isForbiddenMutationOrigin('GET', '/api/users/profile', 'https://attacker.example', allowed)).toBe(false);
  });

  it('keeps signed Meta webhook delivery independent of browser origins', () => {
    expect(isForbiddenMutationOrigin('POST', '/webhooks/instagram', undefined, allowed)).toBe(false);
  });

  it('rejects cookie-authenticated mutations without an Origin header', () => {
    expect(isForbiddenMutationOrigin('POST', '/api/users/profile', undefined, allowed, true)).toBe(true);
  });

  it('allows server-to-server clients without an Origin header or browser cookies', () => {
    expect(isForbiddenMutationOrigin('POST', '/api/payments/verify', undefined, allowed, false)).toBe(false);
  });
});
