import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { createPaymentOrderSchema, verifyPaymentSchema } from './payments.dto';

@Controller('api/payments')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard)
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Get('plans')
  plans() { return { success: true, data: this.service.plans() }; }

  @Get('subscription')
  async subscription(@CurrentUser('userId') userId: string) {
    return { success: true, data: await this.service.subscription(userId) };
  }

  @Post('order')
  async order(@CurrentUser('userId') userId: string, @Body() body: unknown) {
    const parsed = createPaymentOrderSchema.parse(body);
    return { success: true, data: await this.service.createOrder(userId, parsed.plan) };
  }

  @Post('verify')
  async verify(
    @CurrentUser('userId') userId: string,
    @Body() body: unknown,
  ) {
    const parsed = verifyPaymentSchema.parse(body);
    return { success: true, data: await this.service.verify(
      userId, parsed.razorpay_order_id, parsed.razorpay_payment_id, parsed.razorpay_signature,
    ) };
  }
}
