import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';
import { isForbiddenMutationOrigin } from './common/origin-policy';
import { ZodExceptionFilter } from './common/filters/zod-exception.filter';
import { registerFastifyBodyParsers } from './common/register-fastify-body-parsers';

async function bootstrap() {
  // Trust only the immediate hosting proxy hop. Trusting every forwarded hop
  // lets clients spoof their IP and undermines IP-based throttling/logging.
  // Meta may batch many short updates into one signed payload; keep enough
  // room for a 1000-update batch while still bounding per-request memory use.
  const adapter = new FastifyAdapter({ trustProxy: 1, bodyLimit: 5 * 1024 * 1024 });
  registerFastifyBodyParsers(adapter);

  // rawBody:true exposes req.rawBody (Buffer) for webhook signature checks,
  // without colliding with Nest's own JSON body parser.
  // Body parsers are registered explicitly above so Meta's form-encoded
  // signed_request remains a raw string and webhook JSON exposes raw bytes.
  // Disable Nest's automatic parser registration to avoid duplicate Fastify
  // content-type parsers during app.init()/listen().
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    rawBody: true,
    bodyParser: false,
  });
  app.enableShutdownHooks();
  app.useGlobalFilters(new ZodExceptionFilter());

  await app.register(multipart as any, { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 } });
  await app.register(helmet as any, { contentSecurityPolicy: false });
  await app.register(cookie as any, {});
  // Fail CLOSED: with credentials:true, never fall back to allowing every origin.
  // If CORS_ORIGIN is unset we restrict to localhost rather than "*".
  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ?? ['http://localhost:3000'];
  app.enableCors({ origin: corsOrigins, credentials: true });
  adapter.getInstance().addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0];
    const cookieHeader = request.headers.cookie ?? '';
    const hasAuthCookie = /(?:^|;\s*)(?:access_token|refresh_token)=/.test(cookieHeader);
    if (isForbiddenMutationOrigin(request.method, path, request.headers.origin, corsOrigins, hasAuthCookie)) {
      return reply.code(403).send({ statusCode: 403, message: 'Request origin is not allowed' });
    }
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API ready on http://localhost:${port}`);
}
bootstrap();
