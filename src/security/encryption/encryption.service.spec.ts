import * as crypto from 'crypto';
import { EncryptionService } from './encryption.service';

const ENCRYPTION_SECRET = 'test-secret-for-scrypt-kdf';
const ENCRYPTION_SALT = 'test-salt-hex';

function makeService(): EncryptionService {
  process.env.ENCRYPTION_SECRET = ENCRYPTION_SECRET;
  process.env.ENCRYPTION_SALT = ENCRYPTION_SALT;
  return new EncryptionService();
}

describe('EncryptionService', () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_SECRET;
    delete process.env.ENCRYPTION_SALT;
  });

  it('should be defined', () => {
    expect(makeService()).toBeDefined();
  });

  it('throws when ENCRYPTION_SECRET is missing', () => {
    delete process.env.ENCRYPTION_SECRET;
    process.env.ENCRYPTION_SALT = ENCRYPTION_SALT;
    expect(() => new EncryptionService()).toThrow('ENCRYPTION_SECRET');
  });

  it('throws when ENCRYPTION_SALT is missing', () => {
    process.env.ENCRYPTION_SECRET = ENCRYPTION_SECRET;
    delete process.env.ENCRYPTION_SALT;
    expect(() => new EncryptionService()).toThrow('ENCRYPTION_SALT');
  });

  it('derives key using scrypt, not a plain SHA-256 hash', () => {
    const service = makeService();
    // Access private key via casting
    const derivedKey = (service as any).key as Buffer;

    const sha256Key = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
    const scryptKey = crypto.scryptSync(ENCRYPTION_SECRET, ENCRYPTION_SALT, 32, {
      N: 16384,
      r: 8,
      p: 1,
    });

    expect(derivedKey).toEqual(scryptKey);
    expect(derivedKey).not.toEqual(sha256Key);
  });

  it('encrypts and decrypts round-trip correctly', () => {
    const service = makeService();
    const plaintext = 'sensitive data';
    const payload = service.encrypt(plaintext);
    expect(service.decrypt(payload)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const service = makeService();
    const a = service.encrypt('same text');
    const b = service.encrypt('same text');
    expect(a.iv).not.toBe(b.iv);
    expect(a.content).not.toBe(b.content);
  });
});
