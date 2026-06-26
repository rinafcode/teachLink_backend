import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto';

@Injectable()
export class ProviderTokenEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly salt: string;

  constructor() {
    this.salt = process.env.PROVIDER_TOKEN_ENCRYPTION_SALT || 'default-salt';
    const masterSecret = process.env.TOKEN_ENCRYPTION_SECRET || 'fallback-secret';
    this.key = pbkdf2Sync(masterSecret, this.salt, 600000, 32, 'sha256');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return ${iv.toString('hex')}::;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    const decipher = createDecipheriv(this.algorithm, this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}