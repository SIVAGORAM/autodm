import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookAdminController } from './webhook-admin.controller';
import { WebhookService } from './webhook.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@Module({ controllers: [WebhookController, WebhookAdminController], providers: [WebhookService, AdminGuard, SuperAdminGuard] })
export class WebhookModule {}
