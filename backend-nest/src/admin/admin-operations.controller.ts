import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { AdminOperationsService } from './admin-operations.service';

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().trim().min(1).max(80).optional(),
});

const paymentLedgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().min(1).max(100).optional(),
  plan: z.enum(['FREE', 'CREATOR', 'PRO', 'AGENCY']).optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: 'End date must be on or after start date.' });
  }
  for (const [field, date] of [['from', value.from], ['to', value.to]] as const) {
    if (date) {
      const parsedDate = new Date(`${date}T00:00:00.000Z`);
      if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'Enter a valid calendar date.' });
      }
    }
  }
});

@Controller('api/admin/command-center')
@UseGuards(JwtAuthGuard, VerifiedEmailGuard, SuperAdminGuard)
export class AdminOperationsController {
  constructor(private readonly operations: AdminOperationsService) {}

  @Get('overview')
  async overview() {
    return { success: true, data: await this.operations.overview() };
  }

  @Get('audit-events')
  async auditEvents(@Query() query: unknown) {
    const parsed = auditQuerySchema.parse(query);
    return { success: true, data: await this.operations.auditEvents(parsed.page, parsed.pageSize, parsed.action) };
  }

  @Get('payments')
  async paymentLedger(@Query() query: unknown) {
    const parsed = paymentLedgerQuerySchema.parse(query);
    return {
      success: true,
      data: await this.operations.paymentLedger({
        ...parsed,
        currency: parsed.currency?.toUpperCase(),
        from: parsed.from ? new Date(`${parsed.from}T00:00:00.000Z`) : undefined,
        to: parsed.to ? new Date(`${parsed.to}T23:59:59.999Z`) : undefined,
      }),
    };
  }
}
