import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { addAdminSchema, adminPermissionsSchema, updateAdminRoleSchema } from './admin.dto';
import { AdminService } from './admin.service';

@Controller('api/admin/team')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard, SuperAdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  async listTeam() {
    return { success: true, data: await this.admin.listTeam() };
  }

  @Post()
  async addAdmin(@CurrentUser('userId') actorId: string, @Body() body: unknown) {
    const input = addAdminSchema.parse(body);
    return { success: true, data: await this.admin.addAdmin(actorId, input) };
  }

  @Patch(':userId/role')
  async updateRole(
    @CurrentUser('userId') actorId: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ) {
    const targetId = z.string().uuid().parse(userId);
    const input = updateAdminRoleSchema.parse(body);
    return { success: true, data: await this.admin.updateTeamRole(actorId, targetId, input) };
  }

  @Patch(':userId/permissions')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async updatePermissions(@CurrentUser('userId') actorId: string, @Param('userId') userId: string, @Body() body: unknown) {
    const targetId = z.string().uuid().parse(userId);
    const input = adminPermissionsSchema.parse(body);
    return { success: true, data: await this.admin.updateAdminPermissions(actorId, targetId, input) };
  }

  @Post(':userId/suspend')
  async suspendAdmin(@CurrentUser('userId') actorId: string, @Param('userId') userId: string, @Body() body: unknown) {
    const targetId = z.string().uuid().parse(userId);
    const { reason } = z.object({ reason: z.string().trim().min(10).max(500) }).parse(body);
    return { success: true, data: await this.admin.suspendAdmin(actorId, targetId, reason) };
  }

  @Post(':userId/reactivate')
  async reactivateAdmin(@CurrentUser('userId') actorId: string, @Param('userId') userId: string, @Body() body: unknown) {
    const targetId = z.string().uuid().parse(userId);
    const { reason } = z.object({ reason: z.string().trim().min(10).max(500) }).parse(body);
    return { success: true, data: await this.admin.reactivateAdmin(actorId, targetId, reason) };
  }

  @Delete(':userId/mfa')
  async resetMfa(@CurrentUser('userId') actorId: string, @Param('userId') userId: string, @Body() body: unknown) {
    const targetId = z.string().uuid().parse(userId);
    const { reason } = z.object({ reason: z.string().trim().min(10).max(500) }).parse(body);
    return { success: true, data: await this.admin.resetAdminMfa(actorId, targetId, reason) };
  }
}
