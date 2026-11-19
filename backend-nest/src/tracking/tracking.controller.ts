import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { PrismaService } from '../prisma/prisma.service';

@Controller('r')
export class TrackingController {
  constructor(private prisma: PrismaService) {}

  // Click-tracking redirect: GET /r/:slug -> counts a click, then 302s on.
  @Get(':slug')
  async redirect(@Param('slug') slug: string, @Query('c') contactIgsid: string | undefined, @Res() res: FastifyReply) {
    const link = await this.prisma.trackedLink.findUnique({ where: { slug } });
    if (!link) return res.status(404).send('Link not found');
    await this.prisma.$transaction([
      this.prisma.trackedLink.update({ where: { id: link.id }, data: { clicks: { increment: 1 } } }),
      this.prisma.click.create({ data: { trackedLinkId: link.id, contactIgsid: contactIgsid ?? null } }),
    ]);
    return res.redirect(link.targetUrl, 302);
  }
}
