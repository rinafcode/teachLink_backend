import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import * as otplib from 'otplib';
import * as qrcode from 'qrcode';
import * as bcrypt from 'bcrypt';
import { MfaService } from './mfa.service';
import { User } from '../../users/entities/user.entity';
import { EncryptionService } from '../../security/encryption/encryption.service';

jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
  verifySync: jest.fn(),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  genSalt: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('MfaService', () => {
  let service: MfaService;
  let userRepository: jest.Mocked<Repository<User>>;
  let encryptionService: { encrypt: jest.Mock; decrypt: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MfaService,
        {
          provide: getRepositoryToken(User),
          useValue: { save: jest.fn((u) => Promise.resolve(u)) },
        },
        {
          provide: EncryptionService,
          useValue: { encrypt: jest.fn(), decrypt: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<MfaService>(MfaService);
    userRepository = module.get(getRepositoryToken(User));
    encryptionService = module.get(EncryptionService);
  });

  afterEach(() => jest.clearAllMocks());

  function makeUser(overrides: Partial<User> = {}): User {
    return {
      email: 'user@example.com',
      isMfaEnabled: false,
      totpSecret: null,
      mfaRecoveryCodes: [],
      ...overrides,
    } as User;
  }

  describe('generateTotpSecret', () => {
    it('encrypts the secret, hashes recovery codes, saves the user, and returns a QR code + plaintext codes', async () => {
      (otplib.generateSecret as jest.Mock).mockReturnValue('SECRET123');
      (otplib.generateURI as jest.Mock).mockReturnValue('otpauth://totp/x');
      encryptionService.encrypt.mockReturnValue({ iv: 'iv', content: 'enc' });
      (qrcode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,xyz');
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockImplementation((code: string) =>
        Promise.resolve(`hashed:${code}`),
      );

      const user = makeUser();
      const result = await service.generateTotpSecret(user);

      expect(otplib.generateURI).toHaveBeenCalledWith({
        issuer: 'TeachLink',
        label: user.email,
        secret: 'SECRET123',
      });
      expect(encryptionService.encrypt).toHaveBeenCalledWith('SECRET123');
      expect(user.totpSecret).toBe(JSON.stringify({ iv: 'iv', content: 'enc' }));
      expect(user.mfaRecoveryCodes).toHaveLength(5);
      expect(user.mfaRecoveryCodes.every((c) => c.startsWith('hashed:'))).toBe(true);
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(result.qrCodeDataUrl).toBe('data:image/png;base64,xyz');
      expect(result.recoveryCodes).toHaveLength(5);
      // Returned codes are the plaintext originals, not the hashed values persisted on the user.
      expect(result.recoveryCodes.every((c) => !c.startsWith('hashed:'))).toBe(true);
    });

    it('propagates a repository save failure', async () => {
      (otplib.generateSecret as jest.Mock).mockReturnValue('SECRET123');
      (otplib.generateURI as jest.Mock).mockReturnValue('otpauth://totp/x');
      encryptionService.encrypt.mockReturnValue({ iv: 'iv', content: 'enc' });
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const error = new Error('db unavailable');
      userRepository.save.mockRejectedValue(error);

      await expect(service.generateTotpSecret(makeUser())).rejects.toThrow(error);
    });
  });

  describe('verifySetup', () => {
    it('throws BadRequestException when MFA setup was never initiated', async () => {
      const user = makeUser({ totpSecret: null });

      await expect(service.verifySetup(user, '123456')).rejects.toThrow(BadRequestException);
    });

    it('enables MFA and saves when the TOTP code is valid', async () => {
      const user = makeUser({ totpSecret: JSON.stringify({ iv: 'iv', content: 'enc' }) });
      encryptionService.decrypt.mockReturnValue('SECRET123');
      (otplib.verifySync as jest.Mock).mockReturnValue({ valid: true });

      const result = await service.verifySetup(user, '123456');

      expect(otplib.verifySync).toHaveBeenCalledWith({ token: '123456', secret: 'SECRET123' });
      expect(user.isMfaEnabled).toBe(true);
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(result).toEqual({ success: true });
    });

    it('throws BadRequestException for an invalid TOTP code and does not enable MFA', async () => {
      const user = makeUser({ totpSecret: JSON.stringify({ iv: 'iv', content: 'enc' }) });
      encryptionService.decrypt.mockReturnValue('SECRET123');
      (otplib.verifySync as jest.Mock).mockReturnValue({ valid: false });

      await expect(service.verifySetup(user, 'bad')).rejects.toThrow(BadRequestException);
      expect(user.isMfaEnabled).toBe(false);
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('verifyCode', () => {
    it('returns false when MFA is not enabled', async () => {
      const user = makeUser({ isMfaEnabled: false, totpSecret: 'x' });
      await expect(service.verifyCode(user, '123456')).resolves.toBe(false);
    });

    it('returns false when there is no TOTP secret', async () => {
      const user = makeUser({ isMfaEnabled: true, totpSecret: null });
      await expect(service.verifyCode(user, '123456')).resolves.toBe(false);
    });

    it('returns true for a valid TOTP code', async () => {
      const user = makeUser({
        isMfaEnabled: true,
        totpSecret: JSON.stringify({ iv: 'iv', content: 'enc' }),
      });
      encryptionService.decrypt.mockReturnValue('SECRET123');
      (otplib.verifySync as jest.Mock).mockReturnValue({ valid: true });

      await expect(service.verifyCode(user, '123456')).resolves.toBe(true);
    });

    it('falls back to a matching recovery code, consumes it, and saves', async () => {
      const user = makeUser({
        isMfaEnabled: true,
        totpSecret: JSON.stringify({ iv: 'iv', content: 'enc' }),
        mfaRecoveryCodes: ['hashed-a', 'hashed-b'],
      });
      encryptionService.decrypt.mockReturnValue('SECRET123');
      (otplib.verifySync as jest.Mock).mockReturnValue({ valid: false });
      (bcrypt.compare as jest.Mock).mockImplementation((code: string, hash: string) =>
        Promise.resolve(hash === 'hashed-b'),
      );

      const result = await service.verifyCode(user, 'recovery-code');

      expect(result).toBe(true);
      expect(user.mfaRecoveryCodes).toEqual(['hashed-a']);
      expect(userRepository.save).toHaveBeenCalledWith(user);
    });

    it('returns false when neither TOTP nor any recovery code match', async () => {
      const user = makeUser({
        isMfaEnabled: true,
        totpSecret: JSON.stringify({ iv: 'iv', content: 'enc' }),
        mfaRecoveryCodes: ['hashed-a'],
      });
      encryptionService.decrypt.mockReturnValue('SECRET123');
      (otplib.verifySync as jest.Mock).mockReturnValue({ valid: false });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.verifyCode(user, 'nope')).resolves.toBe(false);
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('disableMfa', () => {
    it('clears MFA state and saves when the code is valid', async () => {
      const user = makeUser({
        isMfaEnabled: true,
        totpSecret: JSON.stringify({ iv: 'iv', content: 'enc' }),
        mfaRecoveryCodes: ['hashed-a'],
      });
      encryptionService.decrypt.mockReturnValue('SECRET123');
      (otplib.verifySync as jest.Mock).mockReturnValue({ valid: true });

      const result = await service.disableMfa(user, '123456');

      expect(user.isMfaEnabled).toBe(false);
      expect(user.totpSecret).toBeNull();
      expect(user.mfaRecoveryCodes).toEqual([]);
      expect(result).toEqual({ success: true });
    });

    it('throws BadRequestException and leaves state untouched for an invalid code', async () => {
      const user = makeUser({ isMfaEnabled: true, totpSecret: null });

      await expect(service.disableMfa(user, 'bad')).rejects.toThrow(BadRequestException);
      expect(user.isMfaEnabled).toBe(true);
    });
  });
});
