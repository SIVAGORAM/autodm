import { Module } from '@nestjs/common';
import { TrialService } from './trial.service';

// PrismaModule and MailModule are both @Global, so nothing to import here.
@Module({ providers: [TrialService] })
export class TrialModule {}
