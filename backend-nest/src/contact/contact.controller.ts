import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { publicContactEnquirySchema } from './contact.dto';

@Controller('api/contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post('enquiries')
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  async create(@Body() body: unknown) {
    const input = publicContactEnquirySchema.parse(body);
    return { success: true, data: await this.contact.create(input) };
  }
}
