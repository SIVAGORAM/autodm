import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAdminPermission } from '../common/admin-permissions';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { supportMessageSchema, supportRequestsQuerySchema, supportRequestStatusSchema } from './support.dto';
import { SupportService } from './support.service';

@Controller('api/admin/support-requests')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard, AdminGuard)
export class SupportAdminController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @RequireAdminPermission('SUPPORT_MANAGE')
  async list(@Query() query: unknown) {
    const parsed = supportRequestsQuerySchema.parse(query);
    return { success: true, data: await this.support.listForAdmin(parsed.page, parsed.status) };
  }

  @Patch(':id/status')
  @RequireAdminPermission('SUPPORT_MANAGE')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async updateStatus(@CurrentUser('userId') adminId: string, @Param('id') id: string, @Body() body: unknown) {
    const requestId = z.string().uuid().parse(id);
    const parsed = z.object({ status: supportRequestStatusSchema }).parse(body);
    return { success: true, data: await this.support.updateStatus(requestId, parsed.status, adminId) };
  }

  @Post(':id/messages')
  @RequireAdminPermission('SUPPORT_MANAGE')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async reply(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() body: unknown) {
    const requestId = z.string().uuid().parse(id);
    const input = supportMessageSchema.parse(body);
    return { success: true, data: await this.support.replyAsAdmin(requestId, userId, input) };
  }
}
