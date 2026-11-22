import { Module } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminContactController } from './admin-contact.controller';
import { AdminContactService } from './admin-contact.service';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({
  controllers: [ContactController, AdminContactController],
  providers: [ContactService, AdminContactService, AdminGuard],
})
export class ContactModule {}
