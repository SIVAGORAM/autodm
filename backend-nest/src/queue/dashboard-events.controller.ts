import { Controller, MessageEvent, Sse, UseGuards } from '@nestjs/common';
import { interval, map, merge, takeUntil, timer } from 'rxjs';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DashboardEventsService } from './dashboard-events.service';

@Controller('api/dashboard')
export class DashboardEventsController {
  constructor(private readonly dashboardEvents: DashboardEventsService) {}

  @Sse('events')
  @UseGuards(JwtAuthGuard, VerifiedEmailGuard)
  events(@CurrentUser('userId') userId: string) {
    const keepalive = interval(20_000).pipe(map((): MessageEvent => ({ type: 'keepalive', data: { at: Date.now() } })));
    // Reconnect periodically so authentication/session revocation is checked
    // again instead of leaving a long-lived stream authorized indefinitely.
    return merge(this.dashboardEvents.stream(userId), keepalive).pipe(takeUntil(timer(12 * 60_000)));
  }
}
