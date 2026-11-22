import { createHmac } from 'crypto';
import { WebhookController } from './webhook.controller';

function request(rawBody: Buffer, signature?: string) {
  return {
    ip: '203.0.113.10',
    body: { entry: [] },
    rawBody,
    headers: { 'x-hub-signature-256': signature },
  } as any;
}

function response() {
  const reply: any = {
    status: jest.fn(),
    send: jest.fn(),
  };
  reply.status.mockReturnValue(reply);
  reply.send.mockReturnValue(reply);
  return reply;
}

function setup(throttle = false) {
  const webhook = {
    shouldThrottleInvalidSignature: jest.fn().mockResolvedValue(throttle),
    accept: jest.fn().mockResolvedValue(undefined),
  } as any;
  const config = { get: jest.fn().mockReturnValue('test-secret') } as any;
  return { webhook, controller: new WebhookController(webhook, config) };
}

describe('WebhookController signature abuse control', () => {
  it('counts invalid signatures and returns 401 below the threshold', async () => {
    const { webhook, controller } = setup(false);
    const reply = response();

    await controller.receive(request(Buffer.from('{"entry":[]}'), 'sha256=invalid'), reply);

    expect(webhook.shouldThrottleInvalidSignature).toHaveBeenCalledWith('203.0.113.10');
    expect(webhook.accept).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it('returns 429 when the invalid-signature limit is exceeded', async () => {
    const { webhook, controller } = setup(true);
    const reply = response();

    await controller.receive(request(Buffer.from('{"entry":[]}')), reply);

    expect(webhook.shouldThrottleInvalidSignature).toHaveBeenCalledWith('203.0.113.10');
    expect(webhook.accept).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(429);
  });

  it('never applies the invalid-signature limiter to valid Meta deliveries', async () => {
    const rawBody = Buffer.from('{"entry":[]}');
    const signature = `sha256=${createHmac('sha256', 'test-secret').update(rawBody).digest('hex')}`;
    const { webhook, controller } = setup(true);
    const reply = response();

    await controller.receive(request(rawBody, signature), reply);

    expect(webhook.shouldThrottleInvalidSignature).not.toHaveBeenCalled();
    expect(webhook.accept).toHaveBeenCalledWith({ entry: [] });
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith('EVENT_RECEIVED');
  });
});
