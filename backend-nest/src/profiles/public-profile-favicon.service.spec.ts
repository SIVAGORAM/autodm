import axios from 'axios';
import sharp from 'sharp';
import { isPublicIpv4, PublicProfileFaviconService } from './public-profile-favicon.service';

describe('PublicProfileFaviconService', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    '10.1.2.3', '127.0.0.1', '169.254.1.1', '172.20.0.1', '192.0.2.1', '192.31.196.1',
    '192.52.193.1', '192.88.99.1', '192.168.1.1', '192.175.48.1', '198.18.0.1',
    '100.64.0.1', '224.0.0.1', '240.0.0.1',
  ])
  ('rejects non-public IPv4 ranges returned by DNS: %s', (ip) => {
    expect(isPublicIpv4(ip)).toBe(false);
  });

  it('accepts a public IPv4 answer for a pinned connection', () => {
    expect(isPublicIpv4('8.8.8.8')).toBe(true);
  });

  it.each([
    'http://creator.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://169.254.169.254/latest/meta-data',
    'https://0x7f000001',
    'https://creator.local',
    'https://user:password@creator.com',
    'https://creator.com:8443',
  ])('does not resolve or fetch a disallowed URL: %s', async (url) => {
    const service = new PublicProfileFaviconService();
    const lookup = jest.spyOn(service as any, 'lookupPublicIpv4');
    const get = jest.spyOn(axios, 'get');

    await expect(service.getPng(url)).resolves.toBeNull();
    expect(lookup).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('fails closed when DNS has no public IPv4 address', async () => {
    const service = new PublicProfileFaviconService();
    jest.spyOn(service as any, 'lookupPublicIpv4').mockResolvedValue([]);
    const get = jest.spyOn(axios, 'get');

    await expect(service.getPng('https://creator.com')).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('does not resolve or fetch after the total discovery deadline', async () => {
    const service = new PublicProfileFaviconService();
    const lookup = jest.spyOn(service as any, 'lookupPublicIpv4');
    const get = jest.spyOn(axios, 'get');

    await expect((service as any).fetchPinned(
      new URL('https://creator.com/'), 1024, 'image/png', Date.now() - 1,
    )).resolves.toBeNull();
    expect(lookup).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('validates redirects and refuses a private or link-local redirect target', async () => {
    const service = new PublicProfileFaviconService();
    jest.spyOn(service as any, 'lookupPublicIpv4').mockResolvedValue(['8.8.8.8']);
    const get = jest.spyOn(axios, 'get').mockResolvedValue({
      status: 302, headers: { location: 'https://169.254.169.254/latest/meta-data' }, data: Buffer.alloc(0),
    } as any);

    await expect(service.getPng('https://creator.com')).resolves.toBeNull();
    expect(get.mock.calls.every(([url]) => String(url).startsWith('https://creator.com/'))).toBe(true);
    expect(get.mock.calls.some(([url]) => String(url).includes('169.254.169.254'))).toBe(false);
  });

  it('pins the HTTP connection to the public IP that passed DNS validation', async () => {
    const service = new PublicProfileFaviconService();
    jest.spyOn(service as any, 'lookupPublicIpv4').mockResolvedValue(['8.8.8.8']);
    const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#b9f500' } }).png().toBuffer();
    const get = jest.spyOn(axios, 'get').mockResolvedValue({
      status: 200, headers: { 'content-type': 'image/png' }, data: png,
    } as any);

    await service.getPng('https://creator.com');
    const options = get.mock.calls[0][1] as any;
    const lookup = options.httpsAgent.options.lookup;
    await new Promise<void>((resolve, reject) => lookup('creator.com', { family: 4 }, (error: Error | null, address: string) => {
      if (error) return reject(error);
      expect(address).toBe('8.8.8.8');
      resolve();
    }));
  });

  it('discovers a declared icon, normalizes it to PNG, and caches by origin', async () => {
    const service = new PublicProfileFaviconService();
    jest.spyOn(service as any, 'lookupPublicIpv4').mockResolvedValue(['8.8.8.8']);
    const sourcePng = await sharp({ create: { width: 20, height: 10, channels: 4, background: '#b9f500' } }).png().toBuffer();
    const get = jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, data: Buffer.from('<html><head><link rel="icon" href="/assets/brand.png"></head></html>') } as any)
      .mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'image/png' }, data: sourcePng } as any);

    const result = await service.getPng('https://creator.com/about');
    expect(result?.subarray(1, 4).toString()).toBe('PNG');
    expect(get).toHaveBeenCalledTimes(2);
    await expect(service.getPng('https://creator.com/another-path')).resolves.toEqual(result);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenNthCalledWith(1, 'https://creator.com/', expect.objectContaining({
      timeout: 3000, maxRedirects: 0, proxy: false, maxContentLength: 256 * 1024,
      signal: expect.any(AbortSignal),
    }));
    expect(get).toHaveBeenNthCalledWith(2, 'https://creator.com/assets/brand.png', expect.objectContaining({
      timeout: 3000, maxRedirects: 0, responseType: 'arraybuffer',
    }));
  });

  it('uses the safe fallback when the origin has no supported favicon', async () => {
    const service = new PublicProfileFaviconService();
    jest.spyOn(service as any, 'lookupPublicIpv4').mockResolvedValue(['8.8.8.8']);
    jest.spyOn(axios, 'get').mockResolvedValue({
      status: 404, headers: { 'content-type': 'text/html' }, data: Buffer.from('not found'),
    } as any);

    await expect(service.getPng('https://creator.com')).resolves.toBeNull();
  });
});
