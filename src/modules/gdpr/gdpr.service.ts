import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance, instanceToPlain } from 'class-transformer';
import { UserConsent } from './entities/user-consent.entity';
import { ConsentDto } from './dto/consent.dto';
import { GdprExportDto } from './dto/gdpr-export.dto';
import { User } from '../../users/entities/user.entity';
import { Enrollment } from '../../courses/entities/enrollment.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Notification } from '../../notifications/entities/notification.entity';
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

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,

    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly sessionService: SessionService,
  ) {}

  async exportUserData(userId: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const consents = await this.consentRepository.find({
      where: {
        userId,
      },
      withDeleted: true,
    });

    const enrollments = await this.enrollmentRepository.find({
      where: { userId },
      withDeleted: true,
    });

    const payments = await this.paymentRepository.find({
      where: { userId },
      withDeleted: true,
    });

    const notifications = await this.notificationRepository.find({
      where: { userId },
      withDeleted: true,
    });

    await this.auditService.log('GDPR_EXPORT', userId);

    const gdprExportUserInstance = plainToInstance(GdprExportDto, user);
    const cleanProfile = instanceToPlain(gdprExportUserInstance);

    const addDeletedAtField = <T extends object>(records: T[]): T[] => {
      return records.map((record) => ({
        ...record,
        _deletedAt: (record as any).deletedAt || null,
      }));
    };

    return {
      profile: {
        ...cleanProfile,
        _deletedAt: user.deletedAt || null,
      },
      consents: addDeletedAtField(consents as any[]),
      enrollments: addDeletedAtField(enrollments),
      payments: addDeletedAtField(payments),
      notifications: addDeletedAtField(notifications),
    };
  }

  async eraseUserData(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.deletedAt) {
      return {
        success: true,
        alreadyErased: true,
      };
    }
    await this.sessionService.deleteAllSessionsForUser(userId);

    await this.usersService.update(userId, {
      email: null,
      firstName: '[DELETED]',
      lastName: '[DELETED]',
      deletedAt: new Date(),
      refreshToken: null,
    });

    await this.consentRepository.manager.transaction(async (manager) => {
      // Wrap all DB writes in a transaction with ON CONFLICT DO NOTHING or upsert semantics.
      await manager
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          id: userId,
          email: null as any,
          firstName: '[DELETED]',
          lastName: '[DELETED]',
          deletedAt: new Date(),
        })
        .orUpdate(['email', 'firstName', 'lastName', 'deletedAt'], ['id'])
        .execute();

      await this.usersService.update(userId, {
        email: null,
        firstName: '[DELETED]',
        lastName: '[DELETED]',
        phone: null,
        address: null,
        deletedAt: new Date(),
      });

      await this.auditService.log('GDPR_ERASURE', userId);
    });

    return {
      success: true,
    };
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
