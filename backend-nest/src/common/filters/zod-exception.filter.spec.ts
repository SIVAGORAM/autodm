import { z } from 'zod';
import { Body, Controller, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { ZodExceptionFilter } from './zod-exception.filter';

@Controller('validation-test')
class ValidationTestController {
  @Post()
  validate(@Body() body: unknown) {
    return { value: z.object({ email: z.string().email() }).parse(body) };
  }
}

@Module({ controllers: [ValidationTestController] })
class ValidationTestModule {}

describe('ZodExceptionFilter', () => {
  it('returns a sanitized 400 response for invalid input', () => {
    const parsed = z.object({ email: z.string().email() }).safeParse({ email: 'private-value-not-an-email' });
    if (parsed.success) throw new Error('Expected invalid email input.');

    const send = jest.fn();
    const reply = { code: jest.fn().mockReturnThis(), send };
    const host = { switchToHttp: () => ({ getResponse: () => reply }) };

    new ZodExceptionFilter().catch(parsed.error, host as any);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: expect.arrayContaining([expect.stringContaining('email')]),
    });
    expect(JSON.stringify(send.mock.calls[0])).not.toContain('private-value-not-an-email');
  });

  it('caps the number of returned issues and does not expose issue input values', () => {
    const schema = z.object(Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`field${index}`, z.number()])));
    const parsed = schema.safeParse(Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`field${index}`, `secret-${index}`])));
    if (parsed.success) throw new Error('Expected invalid field input.');

    const send = jest.fn();
    const host = { switchToHttp: () => ({ getResponse: () => ({ code: () => ({ send }) }) }) };
    new ZodExceptionFilter().catch(parsed.error, host as any);

    const payload = send.mock.calls[0][0];
    expect(payload.message).toHaveLength(25);
    expect(JSON.stringify(payload)).not.toContain('secret-');
    expect(payload).not.toHaveProperty('issues');
  });

  it('maps a controller Zod parse failure to an HTTP 400 response', async () => {
    const module = await Test.createTestingModule({ imports: [ValidationTestModule] }).compile();
    const app = module.createNestApplication(new FastifyAdapter());
    app.useGlobalFilters(new ZodExceptionFilter());
    await app.init();
    try {
      const response = await app.getHttpAdapter().getInstance().inject({
        method: 'POST',
        url: '/validation-test',
        payload: { email: 'private-value-not-an-email' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ statusCode: 400, error: 'Bad Request' });
      expect(response.body).not.toContain('private-value-not-an-email');
    } finally {
      await app.close();
    }
  });
});
