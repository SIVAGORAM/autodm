import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private service: UsersService) {}

  @Put('profile')
  async updateProfile(@CurrentUser('userId') userId: string, @Body() body: { name?: string }) {
    return { success: true, data: await this.service.updateProfile(userId, body?.name) };
  }

  @Put('profile/password')
  async changePassword(@CurrentUser('userId') userId: string, @Body() body: { currentPassword?: string; newPassword?: string }) {
    return { success: true, data: await this.service.changePassword(userId, body?.currentPassword ?? '', body?.newPassword ?? '') };
  }
}
