import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookAdminController } from './webhook-admin.controller';
import { WebhookService } from './webhook.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { InstagramModule } from '../instagram/instagram.module';

@Module({
  imports: [InstagramModule],
  controllers: [WebhookController, WebhookAdminController],
  providers: [WebhookService, AdminGuard, SuperAdminGuard],
  exports: [WebhookService],
})
export class WebhookModule {}
