'use client';

import { useState } from 'react';
import { Globe2, Link2 } from 'lucide-react';

export function ProfileFavicon({ url, social = false }: { url: string; social?: boolean }) {
  const [failedUrl, setFailedUrl] = useState('');
  let favicon = '';
  try {
    const target = new URL(url);
    if (['https:', 'http:'].includes(target.protocol) && !target.username && !target.password) {
      favicon = `/api/public/profile-favicon?url=${encodeURIComponent(target.origin)}`;
    }
  } catch { /* validated by the API; keep a safe icon fallback */ }
  if (!favicon || failedUrl === favicon) return social ? <Globe2 size={18} aria-hidden /> : <Link2 size={17} aria-hidden />;
  // The same-origin proxy enforces DNS/IP/redirect restrictions and converts the
  // downloaded raster icon to PNG; visitors never contact the linked domain.
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={favicon} src={favicon} width={20} height={20} alt="" aria-hidden="true" loading="lazy"
    referrerPolicy="no-referrer" onError={() => setFailedUrl(favicon)} style={{ width: 20, height: 20, objectFit: 'contain' }} />;
}
