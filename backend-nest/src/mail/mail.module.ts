import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailOutboxService } from './mail-outbox.service';
import { MailAdminController } from './mail-admin.controller';
import { AdminGuard } from '../common/guards/admin.guard';

@Global()
@Module({
  controllers: [MailAdminController],
  providers: [MailService, MailOutboxService, AdminGuard],
  exports: [MailService, MailOutboxService],
})
export class MailModule {}
