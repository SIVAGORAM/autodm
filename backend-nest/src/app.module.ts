import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { MailModule } from './mail/mail.module';
import { MetaModule } from './meta/meta.module';
import { QueueModule } from './queue/queue.module';
import { QueueServiceModule } from './queue/queue-service.module';
import { AuthModule } from './auth/auth.module';
import { AutomationsModule } from './automations/automations.module';
import { InstagramModule } from './instagram/instagram.module';
import { WebhookModule } from './webhook/webhook.module';
import { TrackingModule } from './tracking/tracking.module';
import { UsersModule } from './users/users.module';
import { PaymentsModule } from './payments/payments.module';
import { TrialModule } from './trial/trial.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    CommonModule,
    MailModule,
    MetaModule,
    QueueModule,
    QueueServiceModule,
    AuthModule,
    AutomationsModule,
    InstagramModule,
    WebhookModule,
    TrackingModule,
    UsersModule,
    PaymentsModule,
    TrialModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
