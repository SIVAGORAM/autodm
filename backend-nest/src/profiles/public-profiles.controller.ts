import { Body, Controller, Get, Header, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAdminPermission } from '../common/admin-permissions';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { ProfilesService } from './profiles.service';
import { createPublicProfileReportSchema, publicProfileReportsQuerySchema, restorePublicProfileSchema, reviewPublicProfileReportSchema } from './public-profile-reports.dto';
import { PublicProfileReportsService } from './public-profile-reports.service';

@Controller('api/public/profiles')
export class PublicProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly reports: PublicProfileReportsService,
  ) {}

  @Get(':username')
  // Visibility changes must take effect immediately; public intermediary caches
  // could otherwise continue serving a profile after the creator makes it private.
  @Header('Cache-Control', 'no-store, max-age=0, must-revalidate')
  async getProfile(@Param('username') username: string) {
    const result = await this.profiles.getPublicProfile(username);
    if ('redirectTo' in result) {
      if (!result.redirectTo) throw new NotFoundException('Profile not found.');
      return { redirectTo: result.redirectTo };
    }
    return result;
  }

  @Post(':username/report')
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  async reportProfile(@Param('username') username: string, @Body() body: unknown) {
    return { success: true, data: await this.reports.create(username, createPublicProfileReportSchema.parse(body)) };
  }
}

@Controller('api/admin/profile-reports')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard, AdminGuard)
export class PublicProfileReportsAdminController {
  constructor(private readonly reports: PublicProfileReportsService) {}

  @Get()
  @RequireAdminPermission('PROFILE_MODERATE')
  async list(@Query() query: unknown) {
    const input = publicProfileReportsQuerySchema.parse(query);
    return { success: true, data: await this.reports.list(input.page, input.status) };
  }

  @Post(':id/review')
  @RequireAdminPermission('PROFILE_MODERATE')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async review(@CurrentUser('userId') adminId: string, @Param('id') id: string, @Body() body: unknown) {
    const reportId = z.string().uuid().parse(id);
    const input = reviewPublicProfileReportSchema.parse(body);
    return { success: true, data: await this.reports.review(reportId, adminId, input) };
  }

  @Post(':id/restore')
  @RequireAdminPermission('PROFILE_MODERATE')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async restore(@CurrentUser('userId') adminId: string, @Param('id') id: string, @Body() body: unknown) {
    const reportId = z.string().uuid().parse(id);
    const input = restorePublicProfileSchema.parse(body);
    return { success: true, data: await this.reports.restore(reportId, adminId, input.reason) };
  }
}
