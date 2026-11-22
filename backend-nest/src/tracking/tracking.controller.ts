import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { verifyClickAttribution } from './click-attribution';

@Controller('r')
export class TrackingController {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

  // Click-tracking redirect: GET /r/:slug -> counts a click, then 302s on.
  @Get(':slug')
  async redirect(
    @Param('slug') slug: string,
    @Query('c') contactIgsidQuery: unknown,
    @Query('s') attributionSignature: unknown,
    @Res() res: FastifyReply,
  ) {
    const link = await this.prisma.trackedLink.findUnique({ where: { slug } });
    if (!link) return res.status(404).send('Link not found');
    let target: URL;
    try {
      target = new URL(link.targetUrl);
    } catch {
      return res.status(410).send('This link is no longer available');
    }
    if ((target.protocol !== 'https:' && target.protocol !== 'http:') || target.username || target.password) {
      return res.status(410).send('This link is no longer available');
    }
    const contactIgsid = typeof contactIgsidQuery === 'string'
      && contactIgsidQuery.length <= 128
      && typeof attributionSignature === 'string'
      && verifyClickAttribution(
        slug,
        contactIgsidQuery,
        attributionSignature,
        this.config.getOrThrow<string>('ENCRYPTION_KEY'),
      )
      ? contactIgsidQuery
      : null;
    await this.prisma.$transaction([
      this.prisma.trackedLink.update({ where: { id: link.id }, data: { clicks: { increment: 1 } } }),
      this.prisma.click.create({ data: { trackedLinkId: link.id, contactIgsid: contactIgsid ?? null } }),
    ]);
    return res.redirect(target.toString(), 302);
  }
}
