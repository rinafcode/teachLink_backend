import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreferences } from '../entities/notification-preferences.entity';

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(
    @InjectRepository(NotificationPreferences)
    private readonly preferencesRepository: Repository<NotificationPreferences>,
  ) {}

  /**
   * Get user preferences or create default if not exists
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    let preferences = await this.preferencesRepository.findOne({ where: { userId } });
    if (!preferences) {
      this.logger.debug(`Creating default preferences for user ${userId}`);
      preferences = this.preferencesRepository.create({ userId });
      preferences = await this.preferencesRepository.save(preferences);
    }
    return preferences;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    updateDto: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const preferences = await this.getPreferences(userId);
    Object.assign(preferences, updateDto);
    return this.preferencesRepository.save(preferences);
  }

  /**
   * Check if a specific channel is enabled for a user
   */
  async isChannelEnabled(
    userId: string,
    channel: 'emailEnabled' | 'pushEnabled' | 'inAppEnabled' | 'smsEnabled',
  ): Promise<boolean> {
    const preferences = await this.getPreferences(userId);
    return !!preferences[channel];
  }

  /**
   * Toggle a specific channel for a user
   */
  async toggleChannel(
    userId: string,
    channel: 'emailEnabled' | 'pushEnabled' | 'inAppEnabled' | 'smsEnabled',
  ): Promise<void> {
    const preferences = await this.getPreferences(userId);
    preferences[channel] = !preferences[channel];
    await this.preferencesRepository.save(preferences);
  }
}
