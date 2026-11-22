import { updatePublicProfileSchema, usernameQuerySchema } from './profiles.dto';

function profileInput(overrides: Record<string, unknown> = {}) {
  return {
    username: 'creator_123',
    displayName: 'Creator',
    bio: 'A short creator bio',
    visibility: 'PRIVATE',
    appearance: 'NEUTRAL',
    socialLinks: [],
    customLinks: [],
    ...overrides,
  };
}

describe('public profile validation', () => {
  it('normalizes usernames to lowercase before availability checks', () => {
    expect(usernameQuerySchema.parse({ username: '  Creator_123  ' }).username).toBe('creator_123');
  });

  it('accepts an ordinary profile with HTTPS links', () => {
    expect(updatePublicProfileSchema.safeParse(profileInput({
      socialLinks: [{ platform: 'instagram', title: 'Instagram', url: 'https://instagram.com/creator', sortOrder: 0, isVisible: true }],
      customLinks: [{ title: 'My site', url: 'https://creator.example.com', description: null, sortOrder: 0, isVisible: true }],
    })).success).toBe(true);
  });

  it('rejects unsupported schemes and embedded credentials', () => {
    for (const url of [
      'javascript:alert(1)',
      'https://user:password@creator.example.com',
      'http://127.0.0.1/private',
      'http://[::1]/private',
      'http://service.internal',
      'http://localhost',
    ]) {
      expect(updatePublicProfileSchema.safeParse(profileInput({
        customLinks: [{ title: 'Link', url, description: null, sortOrder: 0, isVisible: true }],
      })).success).toBe(false);
    }
  });

  it('rejects duplicate social platforms and excessive custom links', () => {
    const link = { platform: 'instagram', title: 'Instagram', url: 'https://instagram.com/creator', sortOrder: 0, isVisible: true };
    expect(updatePublicProfileSchema.safeParse(profileInput({ socialLinks: [link, link] })).success).toBe(false);
    const customLinks = Array.from({ length: 21 }, (_, index) => ({
      title: `Link ${index}`, url: `https://example.com/${index}`, description: null, sortOrder: index, isVisible: true,
    }));
    expect(updatePublicProfileSchema.safeParse(profileInput({ customLinks })).success).toBe(false);
  });
});
