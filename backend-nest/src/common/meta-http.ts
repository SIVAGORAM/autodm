import type { AxiosProxyConfig } from 'axios';

/**
 * Do not let unrelated shell-level HTTP_PROXY variables silently break Meta
 * requests. Direct HTTPS is the default; an operator can opt into a dedicated
 * Meta proxy through META_HTTPS_PROXY when the hosting network requires one.
 */
export function metaHttpOptions(proxyUrl?: string | null): { proxy: AxiosProxyConfig | false } {
  const value = proxyUrl?.trim();
  if (!value) return { proxy: false };

  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('META_HTTPS_PROXY must be an HTTP(S) proxy origin without a path, query, or fragment.');
  }

  return {
    proxy: {
      protocol: parsed.protocol,
      host: parsed.hostname,
      port: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80)),
      ...(parsed.username || parsed.password
        ? { auth: { username: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password) } }
        : {}),
    },
  };
}
