import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '../lib/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPublicSiteUrl();
  return [
    { url: base.toString() },
    { url: new URL('/contact', base).toString() },
    { url: new URL('/cookies', base).toString() },
    { url: new URL('/privacy', base).toString() },
    { url: new URL('/terms', base).toString() },
  ];
}
