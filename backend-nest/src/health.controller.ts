import { Controller, Get, Header, Inject, Optional, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { Queue } from 'bullmq';
import { SkipThrottle, ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { DM_QUEUE_TOKEN } from './queue/queue.constants';
import { hasNoevictionPolicy } from './queue/redis';
import { getWorkerHealth, isLocalWorkerActive } from './queue/worker-health';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from './common/guards/verified-email.guard';
import { AdminGuard } from './common/guards/admin.guard';
import { RequireAdminPermission } from './common/admin-permissions';
import { InProcessWorkerService } from './queue/in-process-worker.service';

type ThrottleHealth = { ping(): Promise<boolean> };
@Controller()
export class HealthController {
  constructor(
    private prisma: PrismaService,
    @Inject(DM_QUEUE_TOKEN) private dmQueue: Queue,
    @Inject(ThrottlerStorage) private throttleStorage: ThrottleHealth,
    private config: ConfigService,
    @Optional() private readonly inProcessWorker?: InProcessWorkerService,
  ) {}

  /** Liveness only: confirms the HTTP process can respond. */
  @Get('health')
  @SkipThrottle()
  check() {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  /** Public, non-secret deploy marker for verifying that API and UI releases match. */
  @Get('api/version')
  @SkipThrottle()
  @Header('Cache-Control', 'no-store')
  version() {
    const commit = this.config.get<string>('RENDER_GIT_COMMIT')?.trim() ?? '';
    const revision = /^[a-f\d]{40}$/i.test(commit) ? commit.slice(0, 12).toLowerCase() : null;
    return { service: 'api', revision };
  }

  /** Readiness: checks database, queue, and shared HTTP throttling dependencies. */
  @Get('ready')
  @SkipThrottle()
  async ready(@Res({ passthrough: true }) res: FastifyReply) {
    const [database, queue, throttling] = await Promise.all([
      this.probe(() => this.prisma.$queryRaw`SELECT 1`),
      this.probe(async () => {
        if (isLocalWorkerActive()) return true;
        return this.dmQueue.getJobCounts();
      }),
      this.probe(() => this.throttleStorage.ping()),
    ]);
    const redisQueuePolicyRequired = this.config.get<boolean>('REDIS_REQUIRE_NOEVICTION') === true ||
      this.config.get('REDIS_REQUIRE_NOEVICTION') === 'true';
    const queueDurability = !redisQueuePolicyRequired || await this.probe(async () =>
      hasNoevictionPolicy(await this.dmQueue.client as unknown as { info(section: string): Promise<string> }),
    );
    const ready = database && queue && throttling && queueDurability;
    res.status(ready ? 200 : 503);
    return {
      status: ready ? 'ready' : 'not_ready',
      checks: {
        database: database ? 'ok' : 'unavailable',
        queue: queue ? 'ok' : 'unavailable',
        throttling: throttling ? 'ok' : 'unavailable',
        redisQueuePolicy: !redisQueuePolicyRequired ? 'not_required' : queueDurability ? 'ok' : 'unsafe_or_unavailable',
      },
      ts: new Date().toISOString(),
    };
  }

  /** Creator-safe delivery status: no queue metrics or operational detail. */
  @Get('api/health/worker')
  @UseGuards(JwtAuthGuard, VerifiedEmailGuard)
  async creatorWorkerStatus() {
    try {
      const health = await getWorkerHealth(this.dmQueue);
      return { success: true, data: { status: health.status, lastHeartbeatAt: health.lastHeartbeatAt } };
    } catch {
      const localActive = isLocalWorkerActive();
      return {
        success: true,
        data: {
          status: localActive ? 'ok' : 'unavailable',
          lastHeartbeatAt: localActive ? new Date().toISOString() : null,
        },
      };
    }
  }

  /** Operator probe for external monitoring; API readiness remains independent of worker availability. */
  @Get('api/admin/health/worker')
  @RequireAdminPermission('OPERATIONS_READ')
  @UseGuards(JwtAuthGuard, VerifiedEmailGuard, AdminGuard)
  async worker(@Res({ passthrough: true }) res: FastifyReply) {
    try {
      const health = await getWorkerHealth(this.dmQueue);
      const ready = health.status === 'ok';
      res.status(ready ? 200 : 503);
      return { ...health, ts: new Date().toISOString() };
    } catch {
      res.status(503);
      return { status: 'unavailable', checks: { worker: 'unavailable' }, ts: new Date().toISOString() };
    }
  }

  private async probe(operation: () => Promise<unknown>): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation().then((result) => result !== false, () => false),
        new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), 1500); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
