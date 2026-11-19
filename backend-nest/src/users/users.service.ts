import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateProfile(userId: string, name?: string) {
    const clean = (name ?? '').trim();
    if (!clean || clean.length < 2) throw new BadRequestException('Name must be at least 2 characters.');
    if (clean.length > 80) throw new BadRequestException('Name is too long.');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: clean },
      select: { id: true, name: true, email: true, isVerified: true },
    });
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters.');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    const ok = await bcrypt.compare(currentPassword ?? '', user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect.');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { success: true };
  }
}
