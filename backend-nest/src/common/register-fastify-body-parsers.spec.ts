import { Controller, Module, Post, Req } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { FastifyRequest } from 'fastify';
import { registerFastifyBodyParsers } from './register-fastify-body-parsers';

@Controller()
class ParserProbeController {
  @Post('/json')
  json(@Req() request: FastifyRequest & { rawBody?: Buffer }) {
    return { body: request.body, rawBody: request.rawBody?.toString('utf8') };
  }

  @Post('/form')
  form(@Req() request: FastifyRequest & { rawBody?: Buffer }) {
    return {
      body: request.body,
      bodyType: typeof request.body,
      rawBody: request.rawBody?.toString('utf8'),
    };
  }
}

@Module({ controllers: [ParserProbeController] })
class ParserProbeModule {}

describe('registerFastifyBodyParsers', () => {
  it('initializes once and preserves JSON webhook bytes and Meta form payloads', async () => {
    const adapter = new FastifyAdapter({ bodyLimit: 5 * 1024 * 1024 });
    registerFastifyBodyParsers(adapter);
    const app = await NestFactory.create(ParserProbeModule, adapter, {
      logger: false,
      rawBody: true,
      bodyParser: false,
    });

    try {
      // Nest's init is where the duplicate parser used to be registered.
      await app.init();

      const jsonBody = '{"entry":[{"id":"123"}]}';
      const jsonResponse = await adapter.inject({
        method: 'POST',
        url: '/json',
        headers: { 'content-type': 'application/json' },
        payload: jsonBody,
      });
      expect(jsonResponse.statusCode).toBe(201);
      expect(jsonResponse.json()).toEqual({ body: { entry: [{ id: '123' }] }, rawBody: jsonBody });

      const formBody = 'signed_request=signature.payload';
      const formResponse = await adapter.inject({
        method: 'POST',
        url: '/form',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: formBody,
      });
      expect(formResponse.statusCode).toBe(201);
      expect(formResponse.json()).toEqual({
        body: formBody,
        bodyType: 'string',
        rawBody: formBody,
      });
    } finally {
      await app.close();
    }
  });
});
