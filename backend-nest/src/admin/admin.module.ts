import { Module } from '@nestjs/common';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { AdminInvitationsController } from './admin-invitations.controller';
import { AdminInvitationAcceptController } from './admin-invitation-accept.controller';
import { AdminInvitationsService } from './admin-invitations.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [AdminController, AdminCustomersController, AdminOperationsController, AdminInvitationsController, AdminInvitationAcceptController],
  providers: [AdminService, AdminCustomersService, AdminOperationsService, AdminInvitationsService, SuperAdminGuard],
})
export class AdminModule {}
