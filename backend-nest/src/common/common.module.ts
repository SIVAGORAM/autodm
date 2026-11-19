import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

// Global so any module (worker processor, token refresh) can inject it.
@Global()
@Module({ providers: [EncryptionService], exports: [EncryptionService] })
export class CommonModule {}
