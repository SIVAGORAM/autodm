import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import CryptoJS from 'crypto-js';

// AES encryption for Instagram access tokens at rest (ported from the
// original Express backend so previously stored tokens stay readable).
@Injectable()
export class EncryptionService {
  private readonly key: string;
  constructor(config: ConfigService) {
    this.key = config.getOrThrow<string>('ENCRYPTION_KEY');
  }
  encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.key).toString();
  }
  decrypt(ciphertext: string): string {
    const bytes = CryptoJS.AES.decrypt(ciphertext, this.key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}
