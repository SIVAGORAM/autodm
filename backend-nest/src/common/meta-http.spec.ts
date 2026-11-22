import { metaHttpOptions } from './meta-http';

describe('Meta outbound HTTP configuration', () => {
  it('bypasses unrelated inherited proxy variables by default', () => {
    expect(metaHttpOptions()).toEqual({ proxy: false });
    expect(metaHttpOptions('   ')).toEqual({ proxy: false });
  });

  it('uses only an explicitly configured HTTP(S) proxy', () => {
    expect(metaHttpOptions('http://user:pass@proxy.example.test:8080')).toEqual({
      proxy: {
        protocol: 'http:',
        host: 'proxy.example.test',
        port: 8080,
        auth: { username: 'user', password: 'pass' },
      },
    });
    expect(metaHttpOptions('https://proxy.example.test')).toEqual({
      proxy: { protocol: 'https:', host: 'proxy.example.test', port: 443 },
    });
  });

  it('rejects proxy URLs with unsupported schemes or paths', () => {
    expect(() => metaHttpOptions('socks5://proxy.example.test:1080')).toThrow(/HTTP\(S\)/);
    expect(() => metaHttpOptions('http://proxy.example.test/proxy')).toThrow(/without a path/);
  });
});
