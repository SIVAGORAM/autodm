import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class KeepAliveService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(KeepAliveService.name);
  private initialWarmupTimer: NodeJS.Timeout | null = null;

  onApplicationBootstrap() {
    if (process.env.NODE_ENV !== 'production') return;

    // Trigger an initial self-ping after 30 seconds to ensure the public DNS/route is ready
    this.initialWarmupTimer = setTimeout(() => {
      this.pingSelf().catch(() => {});
    }, 30_000);
  }

  onApplicationShutdown() {
    if (this.initialWarmupTimer) {
      clearTimeout(this.initialWarmupTimer);
      this.initialWarmupTimer = null;
    }
  }

  /**
   * Pings the public endpoint every 10 minutes to prevent Render free-tier from
   * spinning down (15-min idle timeout) and keep Neon Postgres warm (5-min idle suspend).
   */
  @Cron('*/10 * * * *')
  async pingSelf(): Promise<boolean> {
    const rawUrl = process.env.RENDER_EXTERNAL_URL || 'https://autodm-89w5.onrender.com';
    const targetUrl = `${rawUrl.replace(/\/+$/, '')}/ready`;

    return new Promise<boolean>((resolve) => {
      try {
        const client = targetUrl.startsWith('https') ? https : http;
        const req = client.get(targetUrl, { timeout: 10_000 }, (res) => {
          res.resume(); // consume response data to free memory
          this.logger.log(`Keep-alive ping to ${targetUrl} completed with status ${res.statusCode}`);
          resolve(res.statusCode !== undefined && res.statusCode < 500);
        });

        req.on('timeout', () => {
          req.destroy();
          this.logger.warn(`Keep-alive ping to ${targetUrl} timed out after 10s`);
          resolve(false);
        });

        req.on('error', (err) => {
          this.logger.warn(`Keep-alive ping error: ${err.message}`);
          resolve(false);
        });
      } catch (err: any) {
        this.logger.warn(`Keep-alive ping invocation failed: ${err.message}`);
        resolve(false);
      }
    });
  }
}
