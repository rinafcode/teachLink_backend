import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface IEncryptedPayload {
  iv: string;
  content: string;
  tag: string;
}

/**
 * Provides encryption operations.
 *
 * Key derivation uses scrypt (a memory-hard KDF) instead of a plain SHA-256
 * hash, making brute-force attacks significantly more expensive.
 *
 * Migration note: data encrypted with the old SHA-256-derived key must be
 * re-encrypted once using the old key before rotating to the new key.
 * Run the one-time migration script: `npm run migrate:reencrypt` (see docs/).
 */
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const secret = process.env.ENCRYPTION_SECRET;
    const salt = process.env.ENCRYPTION_SALT;

    if (!secret) {
      throw new Error('ENCRYPTION_SECRET is required to initialize EncryptionService');
    }
    if (!salt) {
      throw new Error('ENCRYPTION_SALT is required to initialize EncryptionService');
    }

    // scrypt: N=16384, r=8, p=1 → 32-byte AES-256 key
    this.key = crypto.scryptSync(secret, salt, 32, { N: 16384, r: 8, p: 1 });
  }

  encrypt(text: string): IEncryptedPayload {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return {
      iv: iv.toString('hex'),
      content: encrypted.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
    };
  }

  decrypt(payload: IEncryptedPayload): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(payload.iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.content, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
