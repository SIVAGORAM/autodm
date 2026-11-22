import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter<ZodError> {
  catch(exception: ZodError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const message = exception.issues.slice(0, 25).map((issue) => {
      const path = issue.path.slice(0, 8).map((part) => String(part).slice(0, 64)).join('.');
      const detail = issue.message.slice(0, 200);
      return path ? `${path}: ${detail}` : detail;
    });

    response.code(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: message.length ? message : ['Invalid request.'],
    });
  }
}
