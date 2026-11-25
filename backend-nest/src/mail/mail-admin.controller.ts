import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { RequireAdminPermission } from '../common/admin-permissions';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { MailOutboxService } from './mail-outbox.service';
import { MailService } from './mail.service';

const mailStatusSchema = z.enum(['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED']).optional();

@Controller('api/admin/mail-outbox')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard, AdminGuard)
export class MailAdminController {
  constructor(
    private readonly mailOutbox: MailOutboxService,
    private readonly mail: MailService,
  ) {}

  @Get()
  @RequireAdminPermission('MAIL_READ')
  async list(@Query('page') page?: string, @Query('status') status?: string) {
    const parsedPage = z.coerce.number().int().min(1).max(100_000).default(1).parse(page);
    const parsedStatus = mailStatusSchema.parse(status || undefined);
    return { success: true, data: await this.mailOutbox.listForAdmin(parsedPage, parsedStatus) };
  }

  @Post('verify-connection')
  @RequireAdminPermission('MAIL_READ')
  async verifyConnection() {
    const result = await this.mail.verifyConnection();
    return { success: result.ok, data: result };
  }
}
