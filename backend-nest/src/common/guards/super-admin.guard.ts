import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId as string | undefined;
    if (!userId) throw new ForbiddenException('Authentication required.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, deletionRequestedAt: true, suspendedAt: true, adminMfaEnabledAt: true },
    });
    if (user?.role !== 'SUPER_ADMIN' || user.deletionRequestedAt || user.suspendedAt) {
      throw new ForbiddenException('Super administrator access required.');
    }
    if (!user.adminMfaEnabledAt) throw new ForbiddenException('Administrator MFA setup is required.');
    return true;
  }
}
