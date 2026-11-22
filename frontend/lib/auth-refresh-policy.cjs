const AUTH_ROUTES_WITHOUT_REFRESH = new Set([
  '/auth/login',
  '/auth/signup',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-otp',
]);

function shouldSkipAuthRefresh(url) {
  if (typeof url !== 'string') return false;
  const path = url.split('?', 1)[0].replace(/\/+$/, '') || '/';
  return AUTH_ROUTES_WITHOUT_REFRESH.has(path);
}

module.exports = { shouldSkipAuthRefresh };
