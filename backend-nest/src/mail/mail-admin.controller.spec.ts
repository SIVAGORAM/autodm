import { MailAdminController } from './mail-admin.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { AdminGuard } from '../common/guards/admin.guard';

describe('MailAdminController', () => {
  it('protects the outbox view with authentication, verified email, and current admin role', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MailAdminController)).toEqual([
      JwtAuthGuard, VerifiedEmailGuard, AdminGuard,
    ]);
  });

  it('validates filters and returns redacted outbox data through the service', async () => {
    const mailOutbox: any = { listForAdmin: jest.fn().mockResolvedValue({ counts: {}, messages: [], hasMore: false }) };
    const controller = new MailAdminController(mailOutbox);

    await expect(controller.list('2', 'FAILED')).resolves.toEqual({
      success: true,
      data: { counts: {}, messages: [], hasMore: false },
    });
    expect(mailOutbox.listForAdmin).toHaveBeenCalledWith(2, 'FAILED');
    await expect(controller.list('0', 'FAILED')).rejects.toThrow();
    await expect(controller.list('1', 'ALL')).rejects.toThrow();
  });
});
