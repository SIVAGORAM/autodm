import { Controller, Get, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply } from 'fastify';
import { PublicProfileFaviconService } from './public-profile-favicon.service';

@Controller('api/public/profile-favicon')
export class PublicProfileFaviconController {
  constructor(private readonly favicons: PublicProfileFaviconService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async get(@Query('url') url: string, @Res() reply: FastifyReply) {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Content-Security-Policy', "default-src 'none'; sandbox");
    if (typeof url !== 'string' || url.length > 2048) return reply.code(204).send();
    const png = await this.favicons.getPng(url);
    if (!png) {
      reply.header('Cache-Control', 'public, max-age=60, s-maxage=300');
      return reply.code(204).send();
    }
    reply.header('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return reply.code(200).type('image/png').send(png);
  }
}
