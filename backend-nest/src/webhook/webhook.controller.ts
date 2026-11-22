import { Controller, Get, Post, Query, Req, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyReply, FastifyRequest } from 'fastify';
import { WebhookService } from './webhook.service';
import { verifyMetaSignature } from './signature';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('webhooks/instagram')
export class WebhookController {
  private readonly log = new Logger(WebhookController.name);
  constructor(private webhook: WebhookService, private config: ConfigService) {}

  // Meta verification handshake.
  @Get()
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string, @Res() res: FastifyReply) {
    if (mode === 'subscribe' && token === this.config.get('META_WEBHOOK_VERIFY_TOKEN')) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // One Meta source IP can carry events for many connected creators; the
  // generic per-IP application throttle would cap them collectively. Keep
  // signature validation and the server body limit on this route instead.
  @Post()
  @SkipThrottle()
  async receive(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const raw: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const sig = req.headers['x-hub-signature-256'] as string | undefined;
    const ok = verifyMetaSignature(raw, sig, this.config.get('META_APP_SECRET', ''));
    if (!ok) {
      if (await this.webhook.shouldThrottleInvalidSignature(req.ip ?? 'unknown')) {
        return res.status(429).send('too many invalid signatures');
      }
      this.log.warn('Rejected webhook with bad signature');
      return res.status(401).send('invalid signature');
    }
    // Ack first, process async — never make Meta wait.
    // Acknowledge only after provider events are persisted and queued. A
    // temporary DB/Redis failure returns a retryable response instead of
    // silently dropping an event after a 200 ACK.
    try {
      await this.webhook.accept(req.body);
      return res.status(200).send('EVENT_RECEIVED');
    } catch {
      this.log.error('Webhook intake failed; event was not acknowledged');
      return res.status(503).send('retry later');
    }
  }
}
