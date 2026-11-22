import { FastifyAdapter } from '@nestjs/platform-fastify';

/**
 * Register the Nest/Fastify parsers before Nest initializes its own parser
 * middleware. `useBodyParser` marks the parser set as registered, which keeps
 * Nest from registering the same content types a second time during `listen()`.
 *
 * The form callback body intentionally stays a string for Meta's
 * signed_request validation. JSON bodies retain Fastify's hardened parser and
 * raw bytes for webhook signature verification.
 */
export function registerFastifyBodyParsers(adapter: FastifyAdapter): void {
  const fastify = adapter.getInstance();
  const { bodyLimit, onProtoPoisoning, onConstructorPoisoning } = fastify.initialConfig;
  const jsonParser = fastify.getDefaultJsonParser(
    onProtoPoisoning || 'error',
    onConstructorPoisoning || 'error',
  );

  adapter.useBodyParser(
    'application/json',
    true,
    { bodyLimit },
    jsonParser as unknown as Parameters<typeof adapter.useBodyParser>[3],
  );
  adapter.useBodyParser(
    'application/x-www-form-urlencoded',
    true,
    { bodyLimit: 16 * 1024 },
    (_request, body, done) => done(null, body.toString('utf8')),
  );
}
