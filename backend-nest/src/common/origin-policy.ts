const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * The frontend proxies browser API traffic through its own origin and session
 * cookies use SameSite=Lax. CORS alone is not a CSRF defense, so reject
 * cookie-authenticated browser mutations without an allowed Origin. Meta
 * webhooks use their own HMAC signature and do not send a browser Origin.
 */
export function isForbiddenMutationOrigin(
  method: string,
  path: string,
  origin: string | undefined,
  allowedOrigins: string[],
  hasAuthCookie = false,
): boolean {
  if (!STATE_CHANGING_METHODS.has(method.toUpperCase()) || path === '/webhooks/instagram' || path === '/api/webhooks/instagram') return false;
  if (!origin) return hasAuthCookie;
  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    return true;
  }
  const allowed = new Set(allowedOrigins.flatMap((value) => {
    try { return [new URL(value.trim()).origin]; } catch { return []; }
  }));
  return !allowed.has(normalizedOrigin);
}
