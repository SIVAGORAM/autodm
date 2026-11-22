import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { ProfilesService } from './profiles.service';

@Controller('api/public/profiles')
export class PublicProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

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
}
