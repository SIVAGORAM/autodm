import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply } from 'fastify';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { acceptAdminInvitationSchema } from './admin.dto';
import { AdminInvitationsService } from './admin-invitations.service';

@Controller('api/admin/invitations')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard)
export class AdminInvitationAcceptController {
  constructor(private readonly invitations: AdminInvitationsService) {}

  @Post('accept')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async accept(@CurrentUser('userId') userId: string, @Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    const { token } = acceptAdminInvitationSchema.parse(body);
    const result = await this.invitations.accept(userId, token);
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/api/auth' });
    return { success: true, data: result };
  }
}
