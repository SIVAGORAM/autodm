import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { AccountDeletionController } from './account-deletion.controller';
import { UsersController } from './users.controller';

describe('AccountDeletionController', () => {
  it('allows an authenticated unverified user to request deletion while other user routes remain verified-only', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AccountDeletionController)).toEqual([JwtAuthGuard]);
    expect(Reflect.getMetadata(GUARDS_METADATA, UsersController)).toEqual([JwtAuthGuard, VerifiedEmailGuard]);
  });

  it('requires the existing password/email confirmation service flow and clears both auth cookies', async () => {
    const result = { requestedAt: new Date('2026-11-21T00:00:00Z'), scheduledFor: new Date('2026-11-21T00:15:00Z') };
    const service = { requestAccountDeletion: jest.fn().mockResolvedValue(result) };
    const reply = { clearCookie: jest.fn() };
    const controller = new AccountDeletionController(service as any);

    await expect(controller.deleteAccount('user-1', {
      currentPassword: 'StrongPass1!',
      confirmationEmail: ' Creator@Example.Test ',
    }, reply as any)).resolves.toEqual({ success: true, data: result });

    expect(service.requestAccountDeletion).toHaveBeenCalledWith('user-1', 'StrongPass1!', 'creator@example.test');
    expect(reply.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
    expect(reply.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/api/auth' });
  });
});
