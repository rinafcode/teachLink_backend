import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key = crypto
    .createHash('sha256')
    .update(process.env.ENCRYPTION_SECRET)
    .digest();

  encrypt(text: string) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);

    return {
      iv: iv.toString('hex'),
      content: encrypted.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
    };
  }

  decrypt(payload: { iv: string; content: string; tag: string }) {
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
