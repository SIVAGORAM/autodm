import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { adminCustomersQuerySchema, customerLifecycleSchema } from './admin.dto';
import { AdminCustomersService } from './admin-customers.service';

@Controller('api/admin/customers')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard, SuperAdminGuard)
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  async list(@Query() query: unknown) {
    return { success: true, data: await this.customers.list(adminCustomersQuerySchema.parse(query)) };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return { success: true, data: await this.customers.detail(z.string().uuid().parse(id)) };
  }

  @Post(':id/suspend')
  async suspend(@CurrentUser('userId') actorId: string, @Param('id') id: string, @Body() body: unknown) {
    const targetId = z.string().uuid().parse(id);
    const { reason } = customerLifecycleSchema.parse(body);
    return { success: true, data: await this.customers.suspend(actorId, targetId, reason) };
  }

  @Post(':id/reactivate')
  async reactivate(@CurrentUser('userId') actorId: string, @Param('id') id: string, @Body() body: unknown) {
    const targetId = z.string().uuid().parse(id);
    const { reason } = customerLifecycleSchema.parse(body);
    return { success: true, data: await this.customers.reactivate(actorId, targetId, reason) };
  }
}
