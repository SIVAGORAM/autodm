import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { AppModule } from './app.module';

async function bootstrap() {
  const adapter = new FastifyAdapter({ trustProxy: true });

  // rawBody:true exposes req.rawBody (Buffer) for webhook signature checks,
  // without colliding with Nest's own JSON body parser.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { rawBody: true });

  await app.register(helmet as any, { contentSecurityPolicy: false });
  await app.register(cookie as any, {});
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API ready on http://localhost:${port}`);
}
bootstrap();
