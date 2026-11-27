import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { effectivePlan } from '../common/plan.util';
import { AutomationsService } from './automations.service';
import { createAutomationSchema, updateAutomationSchema } from './automations.dto';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardEventsService } from '../queue/dashboard-events.service';
import { z } from 'zod';

@Controller('api/automations')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard)
export class AutomationsController {
  constructor(
    private service: AutomationsService,
    private prisma: PrismaService,
    private dashboardEvents: DashboardEventsService,
  ) {}

  private publishAutomationUpdate(userId: string) {
    // The mutation has already committed. Keep SSE advisory and never delay or
    // fail the user's successful save if the Redis Pub/Sub path is unavailable.
    void this.dashboardEvents.publish(userId, 'automation');
  }

  private async plan(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true, trialEndsAt: true } });
    return effectivePlan(u);
  }

  @Post()
  async create(@CurrentUser('userId') userId: string, @Body() body: unknown) {
    const dto = createAutomationSchema.parse(body);
    const data = await this.service.create(userId, await this.plan(userId), dto);
    this.publishAutomationUpdate(userId);
    return { success: true, data };
  }

  @Get()
  async list(@CurrentUser('userId') userId: string) {
    return { success: true, data: await this.service.list(userId) };
  }

  @Get(':id')
  async get(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return { success: true, data: await this.service.get(userId, id) };
  }

  @Patch(':id')
  async update(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() body: unknown) {
    const dto = updateAutomationSchema.parse(body);
    const data = await this.service.update(userId, await this.plan(userId), id, dto);
    this.publishAutomationUpdate(userId);
    return { success: true, data };
  }

  @Patch(':id/status')
  async status(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() body: unknown) {
    const { status } = z.object({ status: z.enum(['DRAFT', 'LIVE', 'PAUSED']) }).parse(body);
    const data = await this.service.setStatus(userId, await this.plan(userId), id, status);
    this.publishAutomationUpdate(userId);
    return { success: true, data };
  }

  @Get(':id/analytics')
  async analytics(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return { success: true, data: await this.service.analytics(userId, id) };
  }

  @Get(':id/runs')
  async runs(@CurrentUser('userId') userId: string, @Param('id') id: string, @Query('cursor') cursor?: string) {
    return { success: true, data: await this.service.runs(userId, id, cursor) };
  }

  @Get(':id/giveaway')
  async getGiveaway(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return { success: true, data: await this.service.getGiveaway(userId, id) };
  }

  @Post(':id/giveaway/pick-winner')
  async pickGiveawayWinner(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    const data = await this.service.pickGiveawayWinner(userId, id);
    this.publishAutomationUpdate(userId);
    return { success: true, data };
  }

  @Post(':id/giveaway/reset-winner')
  async resetGiveawayWinner(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    const data = await this.service.resetGiveawayWinner(userId, id);
    this.publishAutomationUpdate(userId);
    return { success: true, data };
  }

  @Get(':id/giveaway/export')
  async exportGiveawayEntries(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return { success: true, data: await this.service.exportGiveawayEntries(userId, id) };
  }

  @Delete(':id')
  async remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    const data = await this.service.remove(userId, id);
    this.publishAutomationUpdate(userId);
    return data;
  }
}
