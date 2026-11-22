import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private config: ConfigService, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = this.extract(req);
    if (!token) throw new UnauthorizedException('Authentication required');
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        issuer: 'autodm',
        audience: 'web-client',
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { deletionRequestedAt: true, suspendedAt: true, sessionVersion: true },
    });
    const tokenSessionVersion = Number.isInteger(payload.sv) ? payload.sv : 0;
    if (!user || user.deletionRequestedAt || user.suspendedAt || tokenSessionVersion !== user.sessionVersion) {
      throw new UnauthorizedException('Account is unavailable.');
    }
    req.user = { userId: payload.sub, email: payload.email, role: payload.role };
    return true;
  }

  private extract(req: any): string | null {
    const cookieToken = req.cookies?.access_token;
    if (cookieToken) return cookieToken;
    const header: string | undefined = req.headers?.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return null;
  }
}
