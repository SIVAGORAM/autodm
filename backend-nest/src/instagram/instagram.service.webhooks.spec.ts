import axios from 'axios';
import { InstagramService } from './instagram.service';

describe('InstagramService webhook subscription', () => {
  const config = { get: jest.fn((key: string) => key === 'META_GRAPH_VERSION' ? 'v26.0' : undefined) };
  let service: InstagramService;
  let post: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InstagramService(config as any);
    post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { success: true } } as any);
  });

  afterEach(() => post.mockRestore());

  it('subscribes an Instagram Login account to comment and message fields using its user token', async () => {
    await service.subscribeToWebhooks('17841400000000000', 'private-token');

    expect(post).toHaveBeenCalledWith(
      'https://graph.instagram.com/v26.0/17841400000000000/subscribed_apps',
      null,
      { params: { subscribed_fields: 'comments,messages', access_token: 'private-token' }, timeout: 15_000, proxy: false },
    );
  });

  it('returns a safe setup error when Meta rejects the subscription', async () => {
    post.mockRejectedValueOnce({ response: { status: 400, data: { error: { code: 10, message: 'details' } } } });

    await expect(service.subscribeToWebhooks('ig-user', 'private-token'))
      .rejects.toThrow('Meta rejected webhook setup (HTTP 400, code 10). Check the app-level webhook fields, granted permissions, and account eligibility.');
  });

  it('reports a safe network diagnostic without exposing provider response text', async () => {
    post.mockRejectedValueOnce({ code: 'ECONNRESET', message: 'secret request details' });

    await expect(service.subscribeToWebhooks('ig-user', 'private-token'))
      .rejects.toThrow('Could not reach Meta to confirm webhook setup. Check the backend outbound connection and retry.');
  });

  it('uses the Facebook Graph host for Unified Login webhook subscriptions', async () => {
    await service.subscribeToWebhooks('17841400000000000', 'unified-token', 'UNIFIED_LOGIN');
    expect(post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v26.0/17841400000000000/subscribed_apps',
      null,
      { params: { subscribed_fields: 'comments,messages', access_token: 'unified-token' }, timeout: 15_000, proxy: false },
    );
  });
});
