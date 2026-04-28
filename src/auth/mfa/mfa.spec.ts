import { generateTotpSecret, getTotpUri, verifyTotp } from './totp.util';
import { generateBackupCodes, findMatchingBackupCode } from './backup-codes.util';
import { authenticator } from 'otplib';

describe('totp.util', () => {
  describe('generateTotpSecret', () => {
    it('returns a non-empty base32 string', () => {
      const secret = generateTotpSecret();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(0);
    });

    it('generates unique secrets each call', () => {
      expect(generateTotpSecret()).not.toBe(generateTotpSecret());
    });
  });

  describe('getTotpUri', () => {
    it('returns an otpauth:// URI containing the email and app name', () => {
      const uri = getTotpUri('JBSWY3DPEHPK3PXP', 'user@example.com');
      expect(uri).toMatch(/^otpauth:\/\/totp\//);
      expect(uri).toContain('TeachLink');
      expect(uri).toContain('user%40example.com');
    });
  });

  describe('verifyTotp', () => {
    it('returns true for a valid token', () => {
      const secret = generateTotpSecret();
      const token = authenticator.generate(secret);
      expect(verifyTotp(token, secret)).toBe(true);
    });

    it('returns false for an invalid token', () => {
      const secret = generateTotpSecret();
      expect(verifyTotp('000000', secret)).toBe(false);
    });

    it('returns false for a token from a different secret', () => {
      const secret1 = generateTotpSecret();
      const secret2 = generateTotpSecret();
      const token = authenticator.generate(secret1);
      expect(verifyTotp(token, secret2)).toBe(false);
    });
  });
});

describe('backup-codes.util', () => {
  describe('generateBackupCodes', () => {
    it('generates 8 plain codes and 8 hashes', async () => {
      const { plain, hashed } = await generateBackupCodes();
      expect(plain).toHaveLength(8);
      expect(hashed).toHaveLength(8);
    });

    it('plain codes are hex strings of 10 chars', async () => {
      const { plain } = await generateBackupCodes();
      for (const code of plain) {
        expect(code).toMatch(/^[0-9a-f]{10}$/);
      }
    });

    it('generates unique codes each call', async () => {
      const { plain: a } = await generateBackupCodes();
      const { plain: b } = await generateBackupCodes();
      expect(a).not.toEqual(b);
    });
  });

  describe('findMatchingBackupCode', () => {
    it('returns the index of a matching code', async () => {
      const { plain, hashed } = await generateBackupCodes();
      const idx = await findMatchingBackupCode(plain[3], hashed);
      expect(idx).toBe(3);
    });

    it('returns -1 for a non-matching code', async () => {
      const { hashed } = await generateBackupCodes();
      const idx = await findMatchingBackupCode('notacode', hashed);
      expect(idx).toBe(-1);
    });

    it('returns -1 for an empty hashes array', async () => {
      const idx = await findMatchingBackupCode('anything', []);
      expect(idx).toBe(-1);
    });
  });
});
