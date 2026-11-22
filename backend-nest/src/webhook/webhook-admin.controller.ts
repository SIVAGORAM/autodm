import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAdminPermission } from '../common/admin-permissions';
import { AdminGuard } from '../common/guards/admin.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { WebhookService } from './webhook.service';

@Controller('api/admin/webhook-events')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard, AdminGuard)
export class WebhookAdminController {
  constructor(private readonly webhook: WebhookService) {}

  @Get('dead-letter')
  @RequireAdminPermission('OPERATIONS_READ')
  async deadLetters(@Query('page') page?: string) {
    const parsed = z.coerce.number().int().min(1).max(100_000).default(1).parse(page);
    return { success: true, data: await this.webhook.listDeadLetters(parsed) };
  }

  @Post(':id/redrive')
  @RequireAdminPermission('OPERATIONS_READ')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @UseGuards(SuperAdminGuard)
  async redrive(@CurrentUser('userId') adminUserId: string, @Param('id') id: string, @Body() body: unknown) {
    const eventId = z.string().uuid().parse(id);
    const { reason } = z.object({ reason: z.string().trim().min(10).max(500) }).parse(body);
    return { success: true, data: await this.webhook.redriveDeadLetter(eventId, adminUserId, reason) };
  }
}
