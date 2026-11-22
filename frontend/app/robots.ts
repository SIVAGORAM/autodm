import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '../lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/login', '/signup', '/verify', '/forgot-password', '/reset-password'],
    },
    sitemap: new URL('/sitemap.xml', siteUrl).toString(),
  };
}
