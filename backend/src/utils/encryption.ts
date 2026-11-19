// src/utils/encryption.ts
import CryptoJS from 'crypto-js';
import { env } from '../configs/env';

export const encryption = {
  encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, env.ENCRYPTION_KEY).toString();
  },

  decrypt(ciphertext: string): string {
    const bytes = CryptoJS.AES.decrypt(ciphertext, env.ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  },
};
