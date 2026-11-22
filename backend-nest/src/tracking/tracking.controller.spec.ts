import { TrackingController } from './tracking.controller';
import { signClickAttribution } from './click-attribution';

const SECRET = 'test-attribution-secret';

describe('TrackingController', () => {
  function setup(targetUrl: string) {
    const prisma: any = {
      trackedLink: {
        findUnique: jest.fn().mockResolvedValue({ id: 'link-1', targetUrl }),
        update: jest.fn().mockReturnValue(Promise.resolve()),
      },
      $transaction: jest.fn().mockResolvedValue([]),
      click: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const config: any = { getOrThrow: jest.fn(() => SECRET) };
    const response: any = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
    return { controller: new TrackingController(prisma, config), prisma, response };
  }

  it.each(['javascript:alert(1)', 'data:text/html,hello', 'https://user:secret@creator.example', 'not a URL'])(
    'does not redirect to unsafe stored target %s', async (targetUrl) => {
      const { controller, prisma, response } = setup(targetUrl);
      await controller.redirect('slug', undefined, undefined, response);
      expect(response.status).toHaveBeenCalledWith(410);
      expect(response.redirect).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('redirects to a normalized HTTPS URL and records only signed contact attribution', async () => {
    const { controller, prisma, response } = setup('https://creator.example/path');
    const signature = signClickAttribution('slug', '12345', SECRET);
    await controller.redirect('slug', '12345', signature, response);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(response.redirect).toHaveBeenCalledWith('https://creator.example/path', 302);
    expect(prisma.click.create).toHaveBeenCalledWith({
      data: { trackedLinkId: 'link-1', contactIgsid: '12345' },
    });
  });

  it.each([
    ['unsigned legacy contact ID', '12345', undefined],
    ['altered contact ID', '54321', signClickAttribution('slug', '12345', SECRET)],
    ['altered slug', '12345', signClickAttribution('another-slug', '12345', SECRET)],
    ['duplicate query parameters', ['12345', '54321'], signClickAttribution('slug', '12345', SECRET)],
  ])('keeps %s redirect working without trusting contact attribution', async (_label, contactIgsid, signature) => {
    const { controller, prisma, response } = setup('https://creator.example/path');
    await controller.redirect('slug', contactIgsid, signature, response);

    expect(response.redirect).toHaveBeenCalledWith('https://creator.example/path', 302);
    expect(prisma.click.create).toHaveBeenCalledWith({
      data: { trackedLinkId: 'link-1', contactIgsid: null },
    });
  });
});
