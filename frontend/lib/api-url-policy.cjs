const LOCAL_API_URL = 'http://localhost:4000';

function resolveApiBase(configuredUrl, options = {}) {
  const { production = false, requireHttps = false } = options;
  const value = typeof configuredUrl === 'string' ? configuredUrl.trim() : '';

  if (!value) {
    if (production) throw new Error('NEXT_PUBLIC_API_URL is required for production builds.');
    return LOCAL_API_URL;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('NEXT_PUBLIC_API_URL must be an absolute HTTP(S) URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.pathname !== '' && url.pathname !== '/') || url.search || url.hash) {
    throw new Error('NEXT_PUBLIC_API_URL must be an HTTP(S) origin without credentials, path, query, or fragment.');
  }

  const hostname = url.hostname.toLowerCase();
  const loopback = hostname === 'localhost' || hostname.endsWith('.localhost') ||
    hostname.startsWith('127.') || hostname === '[::1]';
  if (requireHttps && (url.protocol !== 'https:' || loopback)) {
    throw new Error('Render production builds require NEXT_PUBLIC_API_URL to use HTTPS and a public hostname.');
  }

  return url.origin;
}

module.exports = { resolveApiBase };
