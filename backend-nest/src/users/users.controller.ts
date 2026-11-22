import { Body, Controller, Get, Param, Patch, Put, Query, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { Readable } from 'node:stream';
import { z } from 'zod';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { updateProfileSchema } from './users.dto';
import { changePasswordSchema } from '../auth/auth.dto';
import { DashboardEventsService } from '../queue/dashboard-events.service';

const contactsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
  accountId: z.string().uuid().optional(),
  search: z.string().trim().max(80).optional(),
});

const updateContactSchema = z.object({
  notes: z.string().trim().max(2000),
  tags: z.array(z.string().trim().min(1).max(24)).max(10),
}).strict();

@Controller('api/users')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard)
export class UsersController {
  constructor(private service: UsersService, private dashboardEvents: DashboardEventsService) {}

  @Get('contacts')
  async contacts(@CurrentUser('userId') userId: string, @Query() query: unknown) {
    const options = contactsQuerySchema.parse(query);
    return { success: true, data: await this.service.listContacts(userId, options) };
  }

  @Patch('contacts/:id')
  async updateContact(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() body: unknown) {
    const parsed = updateContactSchema.parse(body);
    const data = await this.service.updateContact(userId, id, parsed);
    void this.dashboardEvents.publish(userId, 'contacts');
    return { success: true, data };
  }

  @Get('contacts/export')
  async exportContacts(@CurrentUser('userId') userId: string, @Query() query: unknown, @Res() res: FastifyReply) {
    const { accountId, search } = contactsQuerySchema.omit({ page: true, pageSize: true }).parse(query);
    const date = new Date().toISOString().slice(0, 10);
    return res
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="heylaunch-contacts-${date}.csv"`)
      .header('Cache-Control', 'private, no-store, max-age=0')
      .send(Readable.from(this.service.streamContactsCsv(userId, { accountId, search })));
  }

  @Get('export')
  async exportData(@CurrentUser('userId') userId: string, @Res() res: FastifyReply) {
    const data = await this.service.exportData(userId);
    const date = data.exportedAt.slice(0, 10);
    return res
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="heylaunch-data-${date}.json"`)
      .header('Cache-Control', 'private, no-store, max-age=0')
      .send(JSON.stringify(data));
  }

  @Put('profile')
  async updateProfile(@CurrentUser('userId') userId: string, @Body() body: unknown) {
    const parsed = updateProfileSchema.parse(body);
    return { success: true, data: await this.service.updateProfile(userId, parsed.name) };
  }

  @Put('profile/password')
  async changePassword(@CurrentUser('userId') userId: string, @Body() body: unknown) {
    const parsed = changePasswordSchema.parse(body);
    return { success: true, data: await this.service.changePassword(userId, parsed.currentPassword, parsed.newPassword) };
  }

}
