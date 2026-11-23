import { PublicProfileFaviconController } from './public-profile-favicon.controller';

describe('PublicProfileFaviconController', () => {
  const favicons = { getPng: jest.fn() };
  const reply = {
    header: jest.fn(),
    code: jest.fn(),
    type: jest.fn(),
    send: jest.fn(),
  };
  let controller: PublicProfileFaviconController;

  beforeEach(() => {
    jest.clearAllMocks();
    reply.code.mockReturnValue(reply);
    reply.type.mockReturnValue(reply);
    reply.send.mockReturnValue(reply);
    controller = new PublicProfileFaviconController(favicons as any);
  });

  it('sends a normalized PNG with safe headers and a positive cache lifetime', async () => {
    const png = Buffer.from('png-bytes');
    favicons.getPng.mockResolvedValue(png);

    await controller.get('https://creator.com', reply as any);

    expect(favicons.getPng).toHaveBeenCalledWith('https://creator.com');
    expect(reply.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(reply.header).toHaveBeenCalledWith('Content-Security-Policy', "default-src 'none'; sandbox");
    expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.type).toHaveBeenCalledWith('image/png');
    expect(reply.send).toHaveBeenCalledWith(png);
  });

  it('returns a short-cache empty response when no safe icon is found', async () => {
    favicons.getPng.mockResolvedValue(null);

    await controller.get('https://creator.com', reply as any);

    expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'public, max-age=60, s-maxage=300');
    expect(reply.code).toHaveBeenCalledWith(204);
    expect(reply.send).toHaveBeenCalledWith();
  });

  it('rejects an oversized URL without invoking the fetch service', async () => {
    await controller.get('x'.repeat(2049), reply as any);

    expect(favicons.getPng).not.toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(204);
  });
});
