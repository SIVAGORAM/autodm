import { Module } from '@nestjs/common';
import { DmProcessorService } from './dm-processor.service';

@Module({ providers: [DmProcessorService], exports: [DmProcessorService] })
export class QueueServiceModule {}
