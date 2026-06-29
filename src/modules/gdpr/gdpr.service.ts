import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { plainToInstance, instanceToPlain } from 'class-transformer';
import { UserConsent } from './entities/user-consent.entity';
import { ConsentDto } from './dto/consent.dto';
import { GdprExportDto } from './dto/gdpr-export.dto';
import { SessionService } from '../../session/session.service';

@Injectable()
export class GdprService {
  constructor(
    @Inject('UsersService')
    private readonly usersService: any,

    @Inject('AuditService')
    private readonly auditService: any,

    @InjectRepository(UserConsent)
    private readonly consentRepository: Repository<UserConsent>,

    private readonly sessionService: SessionService,

    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async exportUserData(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const consents = await this.consentRepository.find({
      where: {
        userId,
      },
    });

    await this.auditService.log('GDPR_EXPORT', userId);

    const gdprExportUserInstance = plainToInstance(GdprExportDto, user);
    const cleanProfile = instanceToPlain(gdprExportUserInstance);

    return {
      profile: cleanProfile,
      consents,
    };
  }

  async eraseUserData(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Revoke all active sessions immediately (outside transaction — fast path)
    await this.sessionService.deleteAllSessionsForUser(userId);

    await this.dataSource.transaction(async (manager) => {
      // Anonymize payments
      await manager
        .createQueryBuilder()
        .update('payments')
        .set({ userId: null, metadata: null } as any)
        .where('user_id = :userId', { userId })
        .execute();

      // Anonymize enrollments — soft-delete so course analytics remain intact
      await manager
        .createQueryBuilder()
        .update('enrollment')
        .set({ deletedAt: new Date() } as any)
        .where('user_id = :userId AND deleted_at IS NULL', { userId })
        .execute();

      // Anonymize audit logs (null out PII fields, keep the log entry for compliance)
      await manager
        .createQueryBuilder()
        .update('audit_logs')
        .set({ userId: null, userEmail: null, ipAddress: null } as any)
        .where('user_id = :userId', { userId })
        .execute();

      // Soft-delete notifications
      await manager
        .createQueryBuilder()
        .update('notifications')
        .set({ deletedAt: new Date() } as any)
        .where('userId = :userId AND deleted_at IS NULL', { userId })
        .execute();

      // Null out user profile PII
      await manager
        .createQueryBuilder()
        .update('users')
        .set({
          email: null,
          firstName: '[DELETED]',
          lastName: '[DELETED]',
          phone: null,
          address: null,
          refreshToken: null,
          deletedAt: new Date(),
        } as any)
        .where('id = :userId', { userId })
        .execute();
    });

    await this.auditService.log('GDPR_ERASURE', userId);

    return { success: true };
  }

  async updateConsent(userId: string, dto: ConsentDto) {
    const consent = this.consentRepository.create({
      userId,
      consentType: dto.consentType,
      granted: dto.granted,
      revokedAt: dto.granted ? null : new Date(),
    });

    await this.consentRepository.save(consent);

    await this.auditService.log('CONSENT_UPDATED', userId);

    return consent;
  }

  async getConsents(userId: string) {
    return this.consentRepository.find({
      where: {
        userId,
      },
    });
  }
}
