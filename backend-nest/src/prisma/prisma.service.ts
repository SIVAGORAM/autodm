import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const logger = new Logger('PrismaService');

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL');
    const parsed = new URL(connectionString);
    const configuredPoolLimit = Number(parsed.searchParams.get('connection_limit'));
    const max = Number.isInteger(configuredPoolLimit) && configuredPoolLimit > 0
      ? Math.min(configuredPoolLimit, 20)
      : 10;
    const adapter = new PrismaPg({
      connectionString,
      max,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    }, {
      onPoolError: () => {
        // Avoid logging connection details or credentials from driver errors.
        logger.error('PostgreSQL connection pool error.');
      },
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
