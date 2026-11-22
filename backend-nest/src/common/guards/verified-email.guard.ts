import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PRIVACY_VERSION, TERMS_VERSION } from '../../legal/policy-versions';

@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.userId as string | undefined;
    if (!userId) throw new ForbiddenException('Authentication required.');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isVerified: true, termsVersion: true, privacyVersion: true },
    });
    if (!user?.isVerified) throw new ForbiddenException('Verify your email to use this feature.');
    if (this.config.get('LEGAL_POLICY_STATUS', 'DRAFT') === 'APPROVED' &&
      (user.termsVersion !== TERMS_VERSION || user.privacyVersion !== PRIVACY_VERSION)) {
      throw new ForbiddenException('LEGAL_ACCEPTANCE_REQUIRED');
    }
    return true;
  }
}
