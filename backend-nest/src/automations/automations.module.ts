import { Module } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';
import { InstagramModule } from '../instagram/instagram.module';

@Module({ imports: [InstagramModule], providers: [AutomationsService], controllers: [AutomationsController] })
export class AutomationsModule {}
