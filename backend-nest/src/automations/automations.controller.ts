import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { effectivePlan } from '../common/plan.util';
import { AutomationsService } from './automations.service';
import { createAutomationSchema, updateAutomationSchema } from './automations.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/automations')
@UseGuards(JwtAuthGuard)
export class AutomationsController {
  constructor(private service: AutomationsService, private prisma: PrismaService) {}

  private async plan(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true, trialEndsAt: true } });
    return effectivePlan(u);
  }

  @Post()
  async create(@CurrentUser('userId') userId: string, @Body() body: unknown) {
    const dto = createAutomationSchema.parse(body);
    return { success: true, data: await this.service.create(userId, await this.plan(userId), dto) };
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
    return { success: true, data: await this.service.update(userId, await this.plan(userId), id, dto) };
  }

  @Patch(':id/status')
  async status(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() body: { status: 'DRAFT' | 'LIVE' | 'PAUSED' }) {
    return { success: true, data: await this.service.setStatus(userId, id, body.status) };
  }

  @Get(':id/analytics')
  async analytics(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return { success: true, data: await this.service.analytics(userId, id) };
  }

  @Get(':id/runs')
  async runs(@CurrentUser('userId') userId: string, @Param('id') id: string, @Query('cursor') cursor?: string) {
    return { success: true, data: await this.service.runs(userId, id, cursor) };
  }

  @Delete(':id')
  async remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.service.remove(userId, id);
  }
}
