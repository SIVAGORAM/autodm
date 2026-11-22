import { Inject, Injectable, Logger, OnApplicationShutdown, MessageEvent } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { DM_QUEUE_TOKEN } from './queue.constants';
import { safeErrorLabel } from '../common/safe-error-label';

export type DashboardResource = 'automation' | 'delivery' | 'instagram' | 'billing' | 'contacts';

const CHANNEL = 'heylaunch:dashboard-events:v1';
const RESOURCES = new Set<DashboardResource>(['automation', 'delivery', 'instagram', 'billing', 'contacts']);

/** Best-effort Redis Pub/Sub invalidations; source-of-truth data stays in PostgreSQL. */
@Injectable()
export class DashboardEventsService implements OnApplicationShutdown {
  private readonly log = new Logger(DashboardEventsService.name);
  private subscriber: IORedis | null = null;
  private subscriberInit: Promise<IORedis> | null = null;
  private subscribeTask: Promise<void> | null = null;
  private readonly listeners = new Map<string, Set<Subscriber<MessageEvent>>>();

  constructor(@Inject(DM_QUEUE_TOKEN) private readonly queue: Queue) {}

  stream(userId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((listener) => {
      let userListeners = this.listeners.get(userId);
      if (!userListeners) {
        userListeners = new Set();
        this.listeners.set(userId, userListeners);
      }
      userListeners.add(listener);
      void this.ensureSubscriber();

      return () => {
        const current = this.listeners.get(userId);
        current?.delete(listener);
        if (current?.size === 0) this.listeners.delete(userId);
      };
    });
  }

  async publish(userId: string, resource: DashboardResource): Promise<void> {
    if (!userId || !RESOURCES.has(resource)) return;
    try {
      const client = await this.queue.client as unknown as IORedis;
      await client.publish(CHANNEL, JSON.stringify({ userId, resource, at: Date.now() }));
    } catch (error) {
      // Realtime is advisory; a Redis outage must never fail a committed user
      // action or an already completed provider delivery. Queries keep polling.
      this.log.warn(`Dashboard event publish unavailable (${safeErrorLabel(error)})`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    let subscriber = this.subscriber;
    if (!subscriber && this.subscriberInit) {
      try { subscriber = await this.subscriberInit; } catch { return; }
    }
    if (!subscriber) return;
    try {
      await subscriber.unsubscribe(CHANNEL);
      await subscriber.quit();
    } catch (error) {
      this.log.warn(`Dashboard event subscriber shutdown failed (${safeErrorLabel(error)})`);
    } finally {
      this.subscriber = null;
      this.subscriberInit = null;
      this.subscribeTask = null;
      this.listeners.clear();
    }
  }

  private async ensureSubscriber(): Promise<void> {
    try {
      if (!this.subscriber) {
        if (!this.subscriberInit) {
          this.subscriberInit = (async () => {
            const publisher = await this.queue.client as unknown as IORedis;
            const created = publisher.duplicate();
            created.on('message', (channel: string, message: string) => {
              if (channel !== CHANNEL || message.length > 1024) return;
              let event: { userId?: unknown; resource?: unknown; at?: unknown };
              try { event = JSON.parse(message); } catch { return; }
              if (typeof event.userId !== 'string' || typeof event.resource !== 'string' || !RESOURCES.has(event.resource as DashboardResource)) return;
              const data = { resource: event.resource, at: typeof event.at === 'number' ? event.at : Date.now() };
              for (const listener of this.listeners.get(event.userId) ?? []) {
                listener.next({ type: 'invalidate', data });
              }
            });
            created.on('error', (error: unknown) => {
              this.log.warn(`Dashboard event subscriber unavailable (${safeErrorLabel(error)})`);
            });
            this.subscriber = created;
            return created;
          })().finally(() => { this.subscriberInit = null; });
        }
        await this.subscriberInit;
      }
      if (!this.subscribeTask) {
        const subscriber = this.subscriber;
        if (!subscriber) throw new Error('Dashboard event subscriber was not initialized');
        this.subscribeTask = subscriber.subscribe(CHANNEL).then(() => undefined).catch((error: unknown) => {
          this.subscribeTask = null;
          throw error;
        });
      }
      await this.subscribeTask;
    } catch (error) {
      // The HTTP/SSE connection still works without pub/sub; React Query
      // polling is the recovery path and a later client can retry subscription.
      this.log.warn(`Dashboard event subscription unavailable (${safeErrorLabel(error)})`);
    }
  }
}
