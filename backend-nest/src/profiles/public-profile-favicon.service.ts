import { Injectable } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import https from 'node:https';
import * as dns from 'node:dns/promises';
import sharp from 'sharp';

const MAX_HTML_BYTES = 256 * 1024;
const MAX_ICON_BYTES = 256 * 1024;
const MAX_REDIRECTS = 2;
const FETCH_TIMEOUT_MS = 3_000;
const DNS_TIMEOUT_MS = 1_500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 512;
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa', '.test', '.invalid', '.example', '.onion'];
const RASTER_MIME_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/avif',
]);

type CacheEntry = { expiresAt: number; png: Buffer | null };

function ipv4Number(address: string): number | null {
  const parts = address.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  if (octets.some((part) => part > 255)) return null;
  return (((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3]) >>> 0;
}

export function isPublicIpv4(address: string): boolean {
  const ip = ipv4Number(address);
  if (ip === null) return false;
  // IANA special-use, private, loopback, link-local, documentation, multicast,
  // and reserved ranges. Requests are pinned to an address only after this check.
  const blocked: Array<[number, number]> = [
    [0x00000000, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8],
    [0xa9fe0000, 16], [0xac100000, 12], [0xc0000000, 24], [0xc0000200, 24],
    [0xc0586300, 24], [0xc0a80000, 16], [0xc6120000, 15], [0xc6336400, 24],
    [0xcb007100, 24], [0xe0000000, 4], [0xf0000000, 4],
  ];
  return !blocked.some(([network, prefix]) => {
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (ip & mask) === (network & mask);
  });
}

@Injectable()
export class PublicProfileFaviconService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<Buffer | null>>();

  async getPng(rawUrl: string): Promise<Buffer | null> {
    let url: URL;
    try { url = new URL(rawUrl); } catch { return null; }
    if (!this.isAllowedUrl(url)) return null;
    const key = url.origin;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.png;
    if (cached) this.cache.delete(key);

    const pending = this.inFlight.get(key);
    if (pending) return pending;
    const operation = this.discoverAndFetch(url).catch(() => null).then((png) => {
      this.cache.set(key, { png, expiresAt: Date.now() + (png ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS) });
      while (this.cache.size > MAX_CACHE_ENTRIES) {
        const oldest = this.cache.keys().next().value;
        if (oldest === undefined) break;
        this.cache.delete(oldest);
      }
      return png;
    }).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, operation);
    return operation;
  }

  private isAllowedUrl(url: URL): boolean {
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') &&
      hostname.includes('.') && !BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) &&
      !hostname.endsWith('.') && !hostname.startsWith('.') && !hostname.includes('..') &&
      !ipv4Number(hostname) && !hostname.includes(':');
  }

  private async lookupPublicIpv4(hostname: string): Promise<string[]> {
    let timeout: NodeJS.Timeout | undefined;
    const records = await Promise.race([
      dns.lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Favicon DNS lookup timed out')), DNS_TIMEOUT_MS);
      }),
    ]).finally(() => { if (timeout) clearTimeout(timeout); });
    // Reject the whole DNS answer if it contains a non-public IPv4 result. Pinning
    // a validated address prevents a later DNS answer from rebinding the request.
    const ipv4 = records.filter((record) => record.family === 4);
    if (!ipv4.length || ipv4.some((record) => !isPublicIpv4(record.address))) return [];
    return [...new Set(ipv4.map((record) => record.address))];
  }

  private async fetchPinned(url: URL, maxBytes: number, accept: string, redirects = 0): Promise<{ status: number; contentType: string; body: Buffer; url: URL } | null> {
    if (!this.isAllowedUrl(url)) return null;
    const addresses = await this.lookupPublicIpv4(url.hostname);
    if (!addresses.length) return null;

    let response: AxiosResponse<ArrayBuffer> | null = null;
    let lastError: unknown;
    for (const address of addresses.slice(0, 3)) {
      const agent = new https.Agent({
        keepAlive: false,
        lookup: ((_hostname: string, options: { all?: boolean }, callback: (error: NodeJS.ErrnoException | null, address: string | Array<{ address: string; family: number }>, family?: number) => void) => {
          if (options?.all) callback(null, [{ address, family: 4 }]);
          else callback(null, address, 4);
        }) as any,
      });
      try {
        response = await axios.get<ArrayBuffer>(url.toString(), {
          responseType: 'arraybuffer',
          timeout: FETCH_TIMEOUT_MS,
          maxRedirects: 0,
          maxContentLength: maxBytes,
          maxBodyLength: maxBytes,
          validateStatus: () => true,
          headers: { Accept: accept, 'Accept-Encoding': 'identity', 'User-Agent': 'HeyLaunch-Favicon/1.0' },
          httpsAgent: agent,
          proxy: false,
        });
        break;
      } catch (error) {
        lastError = error;
      } finally {
        agent.destroy();
      }
    }
    if (!response) throw lastError ?? new Error('Favicon request failed');

    const status = Number(response.status);
    const contentType = String(response.headers?.['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers?.location;
      if (redirects >= MAX_REDIRECTS || typeof location !== 'string') return null;
      let next: URL;
      try { next = new URL(location, url); } catch { return null; }
      return this.fetchPinned(next, maxBytes, accept, redirects + 1);
    }
    if (status !== 200) return null;
    const body = Buffer.from(response.data as ArrayBuffer);
    if (!body.length || body.length > maxBytes) return null;
    return { status, contentType, body, url };
  }

  private async discoverAndFetch(start: URL): Promise<Buffer | null> {
    const origin = new URL(start.origin);
    const page = await this.fetchPinned(origin, MAX_HTML_BYTES, 'text/html,application/xhtml+xml;q=0.9');
    const candidates: URL[] = [];
    if (page && ['text/html', 'application/xhtml+xml'].includes(page.contentType)) {
      const html = page.body.toString('utf8');
      for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
        const attrs = new Map<string, string>();
        for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
          attrs.set(match[1].toLowerCase(), (match[2] ?? match[3] ?? match[4] ?? '').replace(/&amp;/gi, '&'));
        }
        const rel = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/);
        const href = attrs.get('href');
        if (!href || !rel.some((value) => value === 'icon' || value === 'apple-touch-icon' || value === 'mask-icon')) continue;
        try {
          const candidate = new URL(href, page.url);
          if (this.isAllowedUrl(candidate)) candidates.push(candidate);
        } catch { /* invalid icon declarations are ignored */ }
      }
    }
    candidates.push(new URL('/favicon.ico', origin));

    for (const candidate of candidates.slice(0, 8)) {
      const response = await this.fetchPinned(candidate, MAX_ICON_BYTES, 'image/png,image/jpeg,image/webp,image/avif,image/gif,image/x-icon,image/vnd.microsoft.icon');
      if (!response || !RASTER_MIME_TYPES.has(response.contentType)) continue;
      try {
        return await sharp(response.body, { failOn: 'error', limitInputPixels: 1_000_000 })
          .resize(64, 64, { fit: 'contain', withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer();
      } catch { /* reject mislabeled, corrupt, or unsupported image formats */ }
    }
    return null;
  }
}
