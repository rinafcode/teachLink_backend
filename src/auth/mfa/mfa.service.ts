import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';
import { generateTotpSecret, getTotpUri, generateQrCode, verifyTotp } from './totp.util';
import { generateBackupCodes, findMatchingBackupCode } from './backup-codes.util';

export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Initiates MFA setup: generates a TOTP secret, QR code, and backup codes.
   * The secret is stored but MFA is NOT enabled until the user confirms with a valid token.
   */
  async setupMfa(userId: string): Promise<MfaSetupResponse> {
    const user = await this.usersService.findOne(userId);

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const secret = generateTotpSecret();
    const uri = getTotpUri(secret, user.email);
    const qrCode = await generateQrCode(uri);
    const { plain, hashed } = await generateBackupCodes();

    await this.usersService.updateMfa(userId, {
      mfaSecret: secret,
      mfaBackupCodes: hashed,
      mfaEnabled: false,
    });

    return { secret, qrCode, backupCodes: plain };
  }

  /**
   * Confirms MFA setup by verifying the first TOTP token from the user's authenticator app.
   * Enables MFA on success.
   */
  async confirmMfa(userId: string, token: string): Promise<{ message: string }> {
    const user = await this.usersService.findOne(userId);

    if (!user.mfaSecret) {
      throw new BadRequestException('MFA setup not initiated');
    }
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    if (!verifyTotp(token, user.mfaSecret)) {
      await this.auditLogService.log({
        userId,
        userEmail: user.email,
        action: AuditAction.MFA_FAILED,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.WARNING,
        description: 'MFA confirmation failed — invalid token',
      });
      throw new UnauthorizedException('Invalid TOTP token');
    }

    await this.usersService.updateMfa(userId, { mfaEnabled: true });

    await this.auditLogService.log({
      userId,
      userEmail: user.email,
      action: AuditAction.MFA_ENABLED,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.INFO,
      description: 'MFA enabled',
    });

    return { message: 'MFA enabled successfully' };
  }

  /**
   * Verifies a TOTP token or backup code during login.
   * Returns true if valid, throws otherwise.
   */
  async verifyMfaToken(userId: string, token: string): Promise<true> {
    const user = await this.usersService.findOne(userId);

    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    // Try TOTP first
    if (verifyTotp(token, user.mfaSecret)) {
      return true;
    }

    // Fall back to backup code
    const backupCodes = user.mfaBackupCodes ?? [];
    const matchIndex = await findMatchingBackupCode(token, backupCodes);

    if (matchIndex === -1) {
      await this.auditLogService.log({
        userId,
        userEmail: user.email,
        action: AuditAction.MFA_FAILED,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.WARNING,
        description: 'MFA verification failed — invalid token',
      });
      throw new UnauthorizedException('Invalid MFA token');
    }

    // Consume the used backup code
    const remaining = backupCodes.filter((_, i) => i !== matchIndex);
    await this.usersService.updateMfa(userId, { mfaBackupCodes: remaining });

    return true;
  }

  /**
   * Disables MFA and clears all MFA data for the user.
   */
  async disableMfa(userId: string, token: string): Promise<{ message: string }> {
    const user = await this.usersService.findOne(userId);

    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled');
    }

    if (!verifyTotp(token, user.mfaSecret)) {
      throw new UnauthorizedException('Invalid TOTP token');
    }

    await this.usersService.updateMfa(userId, {
      mfaSecret: null,
      mfaEnabled: false,
      mfaBackupCodes: [],
    });

    await this.auditLogService.log({
      userId,
      userEmail: user.email,
      action: AuditAction.MFA_DISABLED,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.WARNING,
      description: 'MFA disabled',
    });

    return { message: 'MFA disabled successfully' };
  }
}
