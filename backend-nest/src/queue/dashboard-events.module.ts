import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { QueueModule } from './queue.module';
import { DashboardEventsController } from './dashboard-events.controller';

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [DashboardEventsController],
  providers: [JwtAuthGuard],
})
export class DashboardEventsModule {}
