import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { VerifiedEmailGuard } from './guards/verified-email.guard';
import { DmQuotaService } from './dm-quota.service';

// Global so any module (worker processor, token refresh) can inject it.
@Global()
@Module({ providers: [EncryptionService, VerifiedEmailGuard, DmQuotaService], exports: [EncryptionService, VerifiedEmailGuard, DmQuotaService] })
export class CommonModule {}
