import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

@Controller('api/payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Get('plans')
  plans() { return { success: true, data: this.service.plans() }; }

  @Get('subscription')
  async subscription(@CurrentUser('userId') userId: string) {
    return { success: true, data: await this.service.subscription(userId) };
  }

  @Post('order')
  async order(@CurrentUser('userId') userId: string, @Body() body: { plan?: string }) {
    return { success: true, data: await this.service.createOrder(userId, body?.plan) };
  }

  @Post('verify')
  async verify(
    @CurrentUser('userId') userId: string,
    @Body() body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  ) {
    return { success: true, data: await this.service.verify(userId, body?.razorpay_order_id, body?.razorpay_payment_id, body?.razorpay_signature) };
  }

  @Post('cancel')
  async cancel(@CurrentUser('userId') userId: string) {
    return { success: true, data: await this.service.cancel(userId) };
  }
}
