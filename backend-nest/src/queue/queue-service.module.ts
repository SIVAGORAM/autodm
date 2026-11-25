import { Module, forwardRef } from '@nestjs/common';
import { DmProcessorService } from './dm-processor.service';
import { InProcessWorkerService } from './in-process-worker.service';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [forwardRef(() => WebhookModule)],
  providers: [DmProcessorService, InProcessWorkerService],
  exports: [DmProcessorService, InProcessWorkerService],
})
export class QueueServiceModule {}
