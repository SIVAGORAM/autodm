import { Body, Controller, Delete, Get, Post, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import '@fastify/multipart';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProfilesService } from './profiles.service';
import { updatePublicProfileSchema, usernameQuerySchema } from './profiles.dto';

@Controller('api/users/public-profile')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  getMine(@CurrentUser('userId') userId: string) {
    return this.profiles.getOwnerProfile(userId);
  }

  @Get('username-availability')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async usernameAvailability(@CurrentUser('userId') userId: string, @Query('username') username = '') {
    const parsed = usernameQuerySchema.parse({ username });
    return this.profiles.usernameAvailability(userId, parsed.username);
  }

  @Post()
  save(@CurrentUser('userId') userId: string, @Body() body: unknown) {
    return this.profiles.saveProfile(userId, updatePublicProfileSchema.parse(body));
  }

  @Post('avatar')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async uploadAvatar(@CurrentUser('userId') userId: string, @Req() request: FastifyRequest) {
    let file;
    try { file = await request.file({ limits: { files: 1, fileSize: 5 * 1024 * 1024 } }); }
    catch { throw new BadRequestException('Choose an image smaller than 5 MB.'); }
    if (!file) throw new BadRequestException('Select an image to upload.');
    let buffer: Buffer;
    try { buffer = await file.toBuffer(); }
    catch { throw new BadRequestException('Choose an image smaller than 5 MB.'); }
    if (file.file.truncated) throw new BadRequestException('Choose an image smaller than 5 MB.');
    return this.profiles.uploadAvatar(userId, buffer);
  }

  @Delete('avatar')
  removeAvatar(@CurrentUser('userId') userId: string) {
    return this.profiles.removeAvatar(userId);
  }
}
