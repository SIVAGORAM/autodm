import { Controller, Post, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { FastifyRequest } from 'fastify';
import { PaymentsService } from './payments.service';

/** Provider callbacks are authenticated by Razorpay's raw-body HMAC signature. */
@Controller('api/payments')
export class PaymentsWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('webhook')
  @SkipThrottle()
  receive(@Req() request: FastifyRequest) {
    const rawBody = (request as any).rawBody;
    const signature = request.headers['x-razorpay-signature'];
    return this.payments.processWebhook(
      Buffer.isBuffer(rawBody) ? rawBody : Buffer.alloc(0),
      Array.isArray(signature) ? signature[0] : signature,
    );
  }
}
