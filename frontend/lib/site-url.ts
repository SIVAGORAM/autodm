const LOCAL_SITE_URL = 'http://localhost:3000';

export function getPublicSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.RENDER_EXTERNAL_URL ?? LOCAL_SITE_URL;
  const url = new URL(configured);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('The public site URL must use HTTP or HTTPS.');
  }
  return new URL(url.origin);
}
