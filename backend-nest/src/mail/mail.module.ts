import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailOutboxService } from './mail-outbox.service';
import { MailAdminController } from './mail-admin.controller';
import { WeeklyDigestService } from './weekly-digest.service';
import { AdminGuard } from '../common/guards/admin.guard';

@Global()
@Module({
  controllers: [MailAdminController],
  providers: [MailService, MailOutboxService, WeeklyDigestService, AdminGuard],
  exports: [MailService, MailOutboxService, WeeklyDigestService],
})
export class MailModule {}
