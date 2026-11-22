import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailOutboxService } from '../mail/mail-outbox.service';
import { PublicContactEnquiry } from './contact.dto';

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService, private readonly outbox: MailOutboxService) {}

  async create(input: PublicContactEnquiry) {
    // A filled honeypot is acknowledged without persisting or notifying. This
    // avoids teaching simple bots which field triggered the rejection.
    if (input.website?.trim()) return { accepted: true };

    const enquiry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contactEnquiry.create({
        data: {
          name: input.name,
          email: input.email,
          subject: input.subject,
          messages: { create: { kind: 'SUBMISSION', body: input.message } },
        },
        select: { id: true, subject: true, status: true, createdAt: true },
      });
      await this.outbox.queueContactEnquiryNotification(tx, created.id, created.subject);
      return created;
    });
    return { accepted: true };
  }
}
