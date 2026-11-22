import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { createAdminInvitationSchema, revokeAdminInvitationSchema } from './admin.dto';
import { AdminInvitationsService } from './admin-invitations.service';

@Controller('api/admin/team/invitations')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard, SuperAdminGuard)
export class AdminInvitationsController {
  constructor(private readonly invitations: AdminInvitationsService) {}

  @Get()
  async list() {
    return { success: true, data: await this.invitations.list() };
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(@CurrentUser('userId') actorId: string, @Body() body: unknown) {
    const input = createAdminInvitationSchema.parse(body);
    return { success: true, data: await this.invitations.create(actorId, input) };
  }

  @Delete(':id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async revoke(@CurrentUser('userId') actorId: string, @Param('id') id: string, @Body() body: unknown) {
    const invitationId = z.string().uuid().parse(id);
    const input = revokeAdminInvitationSchema.parse(body);
    return { success: true, data: await this.invitations.revoke(actorId, invitationId, input.reason) };
  }
}
