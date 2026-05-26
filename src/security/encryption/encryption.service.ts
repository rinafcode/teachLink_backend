import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface IEncryptedPayload {
  iv: string;
  content: string;
  tag: string;
}

/**
 * Provides encryption operations.
 */
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    this.key = crypto.createHash('sha256').update(this.getEncryptionSecret()).digest();
  }

  private getEncryptionSecret(): string {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) {
      throw new Error('ENCRYPTION_SECRET is required to initialize EncryptionService');
    }
    return secret;
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
