import { Module } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';
import { InstagramModule } from '../instagram/instagram.module';
import { QueueServiceModule } from '../queue/queue-service.module';

@Module({ imports: [InstagramModule, QueueServiceModule], providers: [AutomationsService], controllers: [AutomationsController] })
export class AutomationsModule {}
