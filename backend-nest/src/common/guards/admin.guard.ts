import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_PERMISSION_METADATA, AdminPermission } from '../admin-permissions';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId as string | undefined;
    if (!userId) throw new ForbiddenException('Authentication required.');

    // Read the current role from PostgreSQL rather than trusting a potentially
    // stale role claim embedded in an access token.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, deletionRequestedAt: true, adminMfaEnabledAt: true, adminPermissions: true },
    });
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role) || user.deletionRequestedAt) {
      throw new ForbiddenException('Administrator access required.');
    }
    if (!user.adminMfaEnabledAt) throw new ForbiddenException('Administrator MFA setup is required.');
    if (user.role !== 'SUPER_ADMIN') {
      const required = this.reflector.getAllAndOverride<AdminPermission | undefined>(ADMIN_PERMISSION_METADATA, [
        context.getHandler(), context.getClass(),
      ]);
      if (!required || !user.adminPermissions.includes(required)) {
        throw new ForbiddenException(required ? 'Administrator permission required.' : 'Administrator permission is not configured for this operation.');
      }
    }
    return true;
  }
}
