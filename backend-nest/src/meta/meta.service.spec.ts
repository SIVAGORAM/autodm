import { Logger } from '@nestjs/common';
import axios from 'axios';
import { MetaService } from './meta.service';

describe('MetaService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('defaults Instagram Graph requests to the configured supported API version', () => {
    const create = jest.spyOn(axios, 'create').mockReturnValue({} as any);

    new MetaService({ get: () => undefined } as any);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: 'https://graph.instagram.com/v26.0',
      proxy: false,
    }));
  });

  it('redacts provider messages and account identifiers from logs and returned errors', async () => {
    const sensitiveMessage = 'private response with access_token=do-not-log';
    const post = jest.fn().mockRejectedValue({
      response: { status: 400, data: { error: { code: 190, message: sensitiveMessage } } },
    });
    jest.spyOn(axios, 'create').mockReturnValue({ post } as any);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new MetaService({ get: (key: string) => key === 'META_GRAPH_VERSION' ? 'v26.0' : undefined } as any);

    const result = await service.sendDirectMessage('ig-account-private', 'token-private', 'recipient-private', 'message-private');

    expect(result).toEqual({ ok: false, error: 'Instagram rejected the request (code 190)', code: 190, retryable: false });
    expect(warn).toHaveBeenCalledWith('Meta send_message failed status=400 providerCode=190');
    const observable = JSON.stringify({ result, logs: warn.mock.calls });
    for (const secret of [sensitiveMessage, 'ig-account-private', 'token-private', 'recipient-private', 'message-private']) {
      expect(observable).not.toContain(secret);
    }
  });

  it('marks Instagram Business Use Case rate-limit responses for queue backoff', async () => {
    const post = jest.fn().mockRejectedValue({
      response: { status: 429, data: { error: { code: 80002, message: 'private provider details' } } },
    });
    jest.spyOn(axios, 'create').mockReturnValue({ post } as any);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new MetaService({ get: (key: string) => key === 'META_GRAPH_VERSION' ? 'v26.0' : undefined } as any);

    const result = await service.sendCommentDm('ig-account', 'token', 'comment', 'hello');

    expect(result).toEqual({ ok: false, error: 'Instagram rejected the request (code 80002)', code: 80002, retryable: true });
  });

  it('routes Unified Login private replies to graph.facebook.com', async () => {
    const post = jest.fn().mockResolvedValue({ data: { recipient_id: 'recipient' } });
    jest.spyOn(axios, 'create').mockReturnValue({ post } as any);
    const service = new MetaService({ get: (key: string) => key === 'META_GRAPH_VERSION' ? 'v26.0' : undefined } as any);

    await service.sendCommentDm('ig-account', 'token', 'comment-id', 'hello', [], 'UNIFIED_LOGIN');

    expect(post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v26.0/ig-account/messages',
      { recipient: { comment_id: 'comment-id' }, message: { text: 'hello' } },
      { params: { access_token: 'token' } },
    );
  });

  it.each([
    ['network failure', { response: undefined }, true],
    ['HTTP 429', { response: { status: 429, data: { error: { message: 'busy' } } } }, true],
    ['HTTP 503', { response: { status: 503, data: { error: { message: 'unavailable' } } } }, true],
    ['HTTP 400', { response: { status: 400, data: { error: { code: 100, message: 'invalid' } } } }, false],
  ])('classifies %s provider errors for retry', async (_label, error, retryable) => {
    const post = jest.fn().mockRejectedValue(error);
    jest.spyOn(axios, 'create').mockReturnValue({ post } as any);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new MetaService({ get: (key: string) => key === 'META_GRAPH_VERSION' ? 'v26.0' : undefined } as any);

    const result = await service.sendDirectMessage('ig-account', 'token', 'recipient', 'hello');

    expect(result).toMatchObject({ ok: false, retryable });
  });
});
