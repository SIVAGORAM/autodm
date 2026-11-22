'use client';

import { useState } from 'react';
import { Globe2, Link2 } from 'lucide-react';

export function ProfileFavicon({ url, social = false }: { url: string; social?: boolean }) {
  const [failedUrl, setFailedUrl] = useState('');
  let favicon = '';
  try {
    const target = new URL(url);
    const hostname = target.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    const localSuffix = ['.localhost', '.local', '.internal', '.lan', '.home.arpa', '.test', '.invalid', '.example'];
    const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
    const isLocal = isIpLiteral || !hostname.includes('.') || hostname === 'localhost'
      || localSuffix.some((suffix) => hostname.endsWith(suffix))
      || !['https:', 'http:'].includes(target.protocol) || Boolean(target.username || target.password);
    if (!isLocal) favicon = `${target.origin}/favicon.ico`;
  } catch { /* validated by the API; keep a safe icon fallback */ }
  if (!favicon || failedUrl === favicon) return social ? <Globe2 size={18} aria-hidden /> : <Link2 size={17} aria-hidden />;
  // The browser fetches the linked site's icon directly. No backend URL fetch is used,
  // so user-provided domains cannot turn this feature into an SSRF proxy.
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={favicon} src={favicon} width={20} height={20} alt="" aria-hidden="true" loading="lazy"
    referrerPolicy="no-referrer" onError={() => setFailedUrl(favicon)} style={{ width: 20, height: 20, objectFit: 'contain' }} />;
}
