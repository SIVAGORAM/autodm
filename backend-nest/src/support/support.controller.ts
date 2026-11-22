import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { createSupportRequestSchema, supportMessageSchema } from './support.dto';
import { SupportService } from './support.service';

@Controller('api/support')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('requests')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async create(@CurrentUser('userId') userId: string, @Body() body: unknown) {
    const input = createSupportRequestSchema.parse(body);
    return { success: true, data: await this.support.create(userId, input) };
  }

  @Get('requests/mine')
  async mine(@CurrentUser('userId') userId: string) {
    return { success: true, data: await this.support.listMine(userId) };
  }

  @Post('requests/:id/messages')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async reply(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() body: unknown) {
    const requestId = z.string().uuid().parse(id);
    const input = supportMessageSchema.parse(body);
    return { success: true, data: await this.support.replyAsCustomer(userId, requestId, input) };
  }
}
