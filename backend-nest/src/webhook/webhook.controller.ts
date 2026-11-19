import { Controller, Get, Post, Query, Req, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyReply, FastifyRequest } from 'fastify';
import { WebhookService } from './webhook.service';
import { verifyMetaSignature } from './signature';

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

  @Post()
  async receive(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const raw: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const sig = req.headers['x-hub-signature-256'] as string | undefined;
    const ok = verifyMetaSignature(raw, sig, this.config.get('META_APP_SECRET', ''));
    if (!ok) {
      this.log.warn('Rejected webhook with bad signature');
      return res.status(401).send('invalid signature');
    }
    // Ack first, process async — never make Meta wait.
    res.status(200).send('EVENT_RECEIVED');
    this.webhook.handle(req.body).catch(err => this.log.error(`Webhook processing failed: ${err.message}`));
  }
}
