import { Body, Controller, Delete, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { deleteAccountSchema } from './users.dto';
import { UsersService } from './users.service';

// Account deletion must remain available to a signed-in user before email
// verification. Other product data routes stay behind VerifiedEmailGuard.
@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class AccountDeletionController {
  constructor(private readonly service: UsersService) {}

  @Delete('account')
  async deleteAccount(
    @CurrentUser('userId') userId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const parsed = deleteAccountSchema.parse(body);
    const data = await this.service.requestAccountDeletion(userId, parsed.currentPassword, parsed.confirmationEmail);
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/api/auth' });
    return { success: true, data };
  }
}
