import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance, instanceToPlain } from 'class-transformer';
import { UserConsent } from './entities/user-consent.entity';
import { ConsentDto } from './dto/consent.dto';
import { GdprExportDto } from './dto/gdpr-export.dto';

@Injectable()
export class GdprService {
  constructor(
    @Inject('UsersService')
    private readonly usersService: any,

    @Inject('AuditService')
    private readonly auditService: any,

    @InjectRepository(UserConsent)
    private readonly consentRepository: Repository<UserConsent>,
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

    await this.usersService.update(userId, {
      email: null,
      firstName: '[DELETED]',
      lastName: '[DELETED]',
      phone: null,
      address: null,
      deletedAt: new Date(),
    });

    await this.auditService.log('GDPR_ERASURE', userId);

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
