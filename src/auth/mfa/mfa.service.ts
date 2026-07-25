import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '../../users/entities/user.entity';
import { EncryptionService } from '../../security/encryption/encryption.service';

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly encryptionService: EncryptionService,
  ) {}

  async generateTotpSecret(user: User) {
    const secret = generateSecret();
    const otpauthUrl = generateURI({ issuer: 'TeachLink', label: user.email, secret });

    // Encrypt the secret before storing
    const encryptedSecret = this.encryptionService.encrypt(secret);

    // Generate recovery codes
    const recoveryCodes = Array.from({ length: 5 }, () => crypto.randomBytes(4).toString('hex'));
    const salt = await bcrypt.genSalt(10);
    const hashedCodes = await Promise.all(recoveryCodes.map((code) => bcrypt.hash(code, salt)));

    // Save to user but do NOT enable MFA yet
    user.totpSecret = JSON.stringify(encryptedSecret);
    user.mfaRecoveryCodes = hashedCodes;
    await this.userRepository.save(user);

    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return {
      qrCodeDataUrl,
      recoveryCodes,
    };
  }

  async verifySetup(user: User, code: string) {
    if (!user.totpSecret) {
      throw new BadRequestException('MFA setup has not been initiated');
    }

    const encryptedPayload = JSON.parse(user.totpSecret);
    const secret = this.encryptionService.decrypt(encryptedPayload);

    const isValid = verifySync({ token: code, secret }).valid;
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    user.isMfaEnabled = true;
    await this.userRepository.save(user);

    return { success: true };
  }

  async verifyCode(user: User, code: string): Promise<boolean> {
    if (!user.isMfaEnabled || !user.totpSecret) {
      return false;
    }

    // First try TOTP
    const encryptedPayload = JSON.parse(user.totpSecret);
    const secret = this.encryptionService.decrypt(encryptedPayload);

    const isValid = verifySync({ token: code, secret }).valid;
    if (isValid) {
      return true;
    }

    // If TOTP fails, check recovery codes
    if (user.mfaRecoveryCodes && user.mfaRecoveryCodes.length > 0) {
      for (let i = 0; i < user.mfaRecoveryCodes.length; i++) {
        const isMatch = await bcrypt.compare(code, user.mfaRecoveryCodes[i]);
        if (isMatch) {
          // Remove used recovery code
          user.mfaRecoveryCodes.splice(i, 1);
          await this.userRepository.save(user);
          return true;
        }
      }
    }

    return false;
  }

  async disableMfa(user: User, code: string) {
    const isValid = await this.verifyCode(user, code);
    if (!isValid) {
      throw new BadRequestException('Invalid code');
    }

    user.isMfaEnabled = false;
    user.totpSecret = null;
    user.mfaRecoveryCodes = [];
    await this.userRepository.save(user);

    return { success: true };
  }
}
