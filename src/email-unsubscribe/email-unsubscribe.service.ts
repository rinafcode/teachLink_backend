import { Injectable, Logger } from '@nestjs/common';
import {
  ResourceNotFoundException,
  BusinessValidationException,
  InvalidTokenException,
} from '../common/exceptions/app.exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { UnsubscribeToken } from './entities/unsubscribe-token.entity';
import { EmailSubscription } from '../email-marketing/entities/email-subscription.entity';
import { UnsubscribeDto, ResubscribeDto, UpdateEmailPreferencesDto } from './dto/unsubscribe.dto';

@Injectable()
export class EmailUnsubscribeService {
  private readonly logger = new Logger(EmailUnsubscribeService.name);
  private readonly TOKEN_TTL_HOURS = 72;

  constructor(
    @InjectRepository(UnsubscribeToken)
    private readonly tokenRepository: Repository<UnsubscribeToken>,
    @InjectRepository(EmailSubscription)
    private readonly subscriptionRepository: Repository<EmailSubscription>,
  ) {}

  async generateUnsubscribeToken(email: string, userId?: string, emailType?: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_TTL_HOURS);

    await this.tokenRepository.save(
      this.tokenRepository.create({ token, email, userId, emailType, expiresAt }),
    );

    return token;
  }

  async unsubscribe(dto: UnsubscribeDto): Promise<void> {
    const record = await this.tokenRepository.findOne({ where: { token: dto.token } });

    if (!record) throw new ResourceNotFoundException('UnsubscribeToken');
    if (record.used) throw new BusinessValidationException('Token already used');
    if (record.expiresAt < new Date()) throw new InvalidTokenException('Token has expired');

    await this.tokenRepository.update(record.id, { used: true });

    let subscription = await this.subscriptionRepository.findOne({ where: { email: record.email } });
    if (!subscription) {
      subscription = this.subscriptionRepository.create({ email: record.email, userId: record.userId });
    }

    subscription.isSubscribed = false;
    subscription.unsubscribedAt = new Date();

    if (record.emailType && subscription.preferences) {
      subscription.preferences = subscription.preferences.filter(p => p !== record.emailType);
    }

    await this.subscriptionRepository.save(subscription);
    this.logger.log(`Unsubscribed: ${record.email}`);
  }

  async resubscribe(dto: ResubscribeDto): Promise<void> {
    let subscription = await this.subscriptionRepository.findOne({ where: { email: dto.email } });
    if (!subscription) {
      subscription = this.subscriptionRepository.create({ email: dto.email });
    }

    subscription.isSubscribed = true;
    subscription.unsubscribedAt = undefined;

    if (dto.emailType) {
      const prefs = subscription.preferences || [];
      if (!prefs.includes(dto.emailType)) prefs.push(dto.emailType);
      subscription.preferences = prefs;
    }

    await this.subscriptionRepository.save(subscription);
    this.logger.log(`Resubscribed: ${dto.email}`);
  }

  async updatePreferences(dto: UpdateEmailPreferencesDto): Promise<EmailSubscription> {
    let subscription = await this.subscriptionRepository.findOne({ where: { email: dto.email } });
    if (!subscription) {
      subscription = this.subscriptionRepository.create({ email: dto.email });
    }
    if (dto.preferences !== undefined) subscription.preferences = dto.preferences;
    return this.subscriptionRepository.save(subscription);
  }

  async getSubscriptionStatus(email: string): Promise<EmailSubscription | null> {
    return this.subscriptionRepository.findOne({ where: { email } });
  }
}