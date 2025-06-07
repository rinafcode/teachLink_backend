import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { CreatePreferenceDto, UpdatePreferenceDto } from '../dto/notification.dto';
import { NotificationType } from '../entities/notification.entity';

@Injectable()
export class PreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private preferencesRepository: Repository<NotificationPreference>,
  ) {}

  async createPreference(createPreferenceDto: CreatePreferenceDto): Promise<NotificationPreference> {
    const preference = this.preferencesRepository.create(createPreferenceDto);
    return await this.preferencesRepository.save(preference);
  }

  async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    return await this.preferencesRepository.find({
      where: { userId }
    });
  }

  async getPreferenceByType(userId: string, type: NotificationType): Promise<NotificationPreference | null> {
    return await this.preferencesRepository.findOne({
      where: { userId, notificationType: type }
    });
  }

  async updatePreference(
    userId: string,
    type: NotificationType,
    updatePreferenceDto: UpdatePreferenceDto
  ): Promise<NotificationPreference> {
    const preference = await this.getPreferenceByType(userId, type);
    
    if (!preference) {
      throw new NotFoundException('Preference not found');
    }

    Object.assign(preference, updatePreferenceDto);
    return await this.preferencesRepository.save(preference);
  }

  async initializeDefaultPreferences(userId: string): Promise<NotificationPreference[]> {
    const defaultPreferences = Object.values(NotificationType).map(type => ({
      userId,
      notificationType: type,
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      settings: {}
    }));

    const preferences = this.preferencesRepository.create(defaultPreferences);
    return await this.preferencesRepository.save(preferences);
  }

  async canSendNotification(userId: string, type: NotificationType, channel: 'email' | 'push' | 'inApp'): Promise<boolean> {
    const preference = await this.getPreferenceByType(userId, type);
    
    if (!preference) {
      return true; // Default to enabled if no preference set
    }

    switch (channel) {
      case 'email':
        return preference.emailEnabled;
      case 'push':
        return preference.pushEnabled;
      case 'inApp':
        return preference.inAppEnabled;
      default:
        return true;
    }
  }
}