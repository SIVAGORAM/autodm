import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireAdminPermission } from '../common/admin-permissions';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import {
  contactEnquiriesQuerySchema, contactEnquiryMessageSchema, contactEnquiryPrioritySchema,
  contactEnquiryStatusSchema,
} from './contact.dto';
import { AdminContactService } from './admin-contact.service';

@Controller('api/admin/contact-enquiries')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard, AdminGuard)
export class AdminContactController {
  constructor(private readonly contact: AdminContactService) {}

  @Get()
  @RequireAdminPermission('CONTACT_MANAGE')
  async list(@CurrentUser('userId') adminId: string, @Query() query: unknown) {
    return { success: true, data: await this.contact.list(adminId, contactEnquiriesQuerySchema.parse(query)) };
  }

  @Get(':id')
  @RequireAdminPermission('CONTACT_MANAGE')
  async detail(@Param('id') id: string) {
    return { success: true, data: await this.contact.detail(z.string().uuid().parse(id)) };
  }

  @Patch(':id/status')
  @RequireAdminPermission('CONTACT_MANAGE')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async updateStatus(@CurrentUser('userId') adminId: string, @Param('id') id: string, @Body() body: unknown) {
    const enquiryId = z.string().uuid().parse(id);
    const input = contactEnquiryStatusSchema.parse(body);
    return { success: true, data: await this.contact.updateStatus(adminId, enquiryId, input.status, input.reason) };
  }

  @Patch(':id/priority')
  @RequireAdminPermission('CONTACT_MANAGE')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async updatePriority(@CurrentUser('userId') adminId: string, @Param('id') id: string, @Body() body: unknown) {
    const enquiryId = z.string().uuid().parse(id);
    const input = contactEnquiryPrioritySchema.parse(body);
    return { success: true, data: await this.contact.updatePriority(adminId, enquiryId, input.priority, input.reason) };
  }

  @Patch(':id/assignment')
  @RequireAdminPermission('CONTACT_MANAGE')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async assign(@CurrentUser('userId') adminId: string, @Param('id') id: string, @Body() body: unknown) {
    const enquiryId = z.string().uuid().parse(id);
    const { assignedAdminId } = z.object({ assignedAdminId: z.string().uuid().nullable() }).parse(body);
    return { success: true, data: await this.contact.assign(adminId, enquiryId, assignedAdminId) };
  }

  @Post(':id/messages')
  @RequireAdminPermission('CONTACT_MANAGE')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async reply(@CurrentUser('userId') adminId: string, @Param('id') id: string, @Body() body: unknown) {
    const enquiryId = z.string().uuid().parse(id);
    const input = contactEnquiryMessageSchema.parse(body);
    return { success: true, data: await this.contact.addMessage(adminId, enquiryId, input.body, 'ADMIN_REPLY') };
  }

  @Post(':id/notes')
  @RequireAdminPermission('CONTACT_MANAGE')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async addNote(@CurrentUser('userId') adminId: string, @Param('id') id: string, @Body() body: unknown) {
    const enquiryId = z.string().uuid().parse(id);
    const input = contactEnquiryMessageSchema.parse(body);
    return { success: true, data: await this.contact.addMessage(adminId, enquiryId, input.body, 'INTERNAL_NOTE') };
  }
}
