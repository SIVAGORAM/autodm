import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AdminGuard } from './common/guards/admin.guard';
import { validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { MailModule } from './mail/mail.module';
import { MetaModule } from './meta/meta.module';
import { QueueModule } from './queue/queue.module';
import { QueueServiceModule } from './queue/queue-service.module';
import { DashboardEventsModule } from './queue/dashboard-events.module';
import { AuthModule } from './auth/auth.module';
import { AutomationsModule } from './automations/automations.module';
import { InstagramModule } from './instagram/instagram.module';
import { WebhookModule } from './webhook/webhook.module';
import { TrackingModule } from './tracking/tracking.module';
import { UsersModule } from './users/users.module';
import { PaymentsModule } from './payments/payments.module';
import { TrialModule } from './trial/trial.module';
import { SupportModule } from './support/support.module';
import { AdminModule } from './admin/admin.module';
import { ContactModule } from './contact/contact.module';
import { HealthController } from './health.controller';
import { RedisThrottlerStorage } from './common/redis-throttler-storage';
import { areScheduledJobsEnabled } from './common/scheduled-jobs';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot({ cronJobs: areScheduledJobsEnabled() }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        storage: new RedisThrottlerStorage(config.getOrThrow<string>('REDIS_URL')),
      }),
    }),
    PrismaModule,
    CommonModule,
    MailModule,
    MetaModule,
    QueueModule,
    QueueServiceModule,
    DashboardEventsModule,
    AuthModule,
    AutomationsModule,
    InstagramModule,
    WebhookModule,
    TrackingModule,
    UsersModule,
    PaymentsModule,
    TrialModule,
    SupportModule,
    AdminModule,
    ContactModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    AdminGuard,
  ],
})
export class AppModule {}
