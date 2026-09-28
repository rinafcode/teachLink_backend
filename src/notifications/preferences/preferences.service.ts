import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreferences } from '../entities/notification-preferences.entity';
import {
  CHANNEL_KEYS,
  EVENT_FREQUENCIES,
  KNOWN_EVENT_TYPES,
  SECURITY_CRITICAL_EVENT_TYPES,
} from './notification-preferences.constants';

/** Top-level preference keys accepted by `updatePreferences`. */
const KNOWN_TOP_LEVEL_KEYS = new Set<string>([
  'emailEnabled',
  'pushEnabled',
  'inAppEnabled',
  'smsEnabled',
  'topicSubscriptions',
  'eventFrequency',
  'quietTimeStart',
  'quietTimeEnd',
  'globalUnsubscribe',
]);

/**
 * Provides preferences operations.
 */
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
   * Update user preferences.
   *
   * Incoming keys are validated against a known allowlist (unknown keys are
   * rejected with a 400) and security-critical event types cannot be disabled.
   */
  async updatePreferences(
    userId: string,
    updateDto: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    this.assertValidUpdateKeys(updateDto);

    const preferences = await this.getPreferences(userId);
    Object.assign(preferences, updateDto);

    // When the update touches delivery channels, ensure at least one remains
    // enabled so security-critical notifications always retain a delivery path.
    const touchesChannels = CHANNEL_KEYS.some((key) => key in updateDto);
    if (touchesChannels) {
      const enabledCount = CHANNEL_KEYS.filter((key) => preferences[key]).length;
      if (enabledCount === 0) {
        throw new BadRequestException(
          'At least one delivery channel must remain enabled for security-critical notifications',
        );
      }
    }

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
   * Toggle a specific channel for a user.
   *
   * Unknown channels are rejected with a 400, and disabling the last remaining
   * enabled delivery channel is refused so security-critical notifications can
   * never be left without a delivery path.
   */
  async toggleChannel(
    userId: string,
    channel: 'emailEnabled' | 'pushEnabled' | 'inAppEnabled' | 'smsEnabled',
  ): Promise<NotificationPreferences> {
    if (!CHANNEL_KEYS.includes(channel)) {
      throw new BadRequestException(`Unknown notification channel "${channel}"`);
    }

    const preferences = await this.getPreferences(userId);

    // Refuse to disable the last remaining enabled channel.
    if (preferences[channel]) {
      const otherEnabled = CHANNEL_KEYS.filter((key) => key !== channel && preferences[key]).length;
      if (otherEnabled === 0) {
        throw new BadRequestException(
          'At least one delivery channel must remain enabled for security-critical notifications',
        );
      }
    }

    preferences[channel] = !preferences[channel];
    return this.preferencesRepository.save(preferences);
  }

  /**
   * Unsubscribe user from a specific event type or all notifications.
   *
   * Security-critical event types (new-device login, password change, payment
   * receipts, account deletion) can never be unsubscribed from: they alert on
   * account compromise and must remain reachable even if a session is hijacked.
   */
  async unsubscribe(userId: string, eventType: string): Promise<NotificationPreferences> {
    if (eventType !== 'all') {
      if (!KNOWN_EVENT_TYPES.has(eventType)) {
        throw new BadRequestException(`Unknown event type "${eventType}"`);
      }
      if (SECURITY_CRITICAL_EVENT_TYPES.has(eventType)) {
        throw new BadRequestException(
          `Event type "${eventType}" is security-critical and cannot be disabled`,
        );
      }
    }

    const preferences = await this.getPreferences(userId);

    if (eventType === 'all') {
      preferences.globalUnsubscribe = true;
    } else {
      if (!preferences.eventFrequency) {
        preferences.eventFrequency = {};
      }
      preferences.eventFrequency[eventType] = 'never';
    }

    return this.preferencesRepository.save(preferences);
  }

  /**
   * Validates incoming preference keys against the allowlist and rejects any
   * attempt to disable a security-critical event type.
   */
  private assertValidUpdateKeys(updateDto: Partial<NotificationPreferences>): void {
    for (const key of Object.keys(updateDto)) {
      if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
        throw new BadRequestException(`Unknown preference key "${key}"`);
      }
    }

    if (updateDto.eventFrequency) {
      for (const [eventType, frequency] of Object.entries(updateDto.eventFrequency)) {
        if (!KNOWN_EVENT_TYPES.has(eventType)) {
          throw new BadRequestException(`Unknown event type "${eventType}"`);
        }
        if (!EVENT_FREQUENCIES.has(frequency as string)) {
          throw new BadRequestException(
            `Invalid frequency "${frequency}" for event type "${eventType}"`,
          );
        }
        if (frequency === 'never' && SECURITY_CRITICAL_EVENT_TYPES.has(eventType)) {
          throw new BadRequestException(
            `Event type "${eventType}" is security-critical and cannot be disabled`,
          );
        }
      }
    }

    if (updateDto.topicSubscriptions) {
      for (const [eventType, enabled] of Object.entries(updateDto.topicSubscriptions)) {
        if (!KNOWN_EVENT_TYPES.has(eventType)) {
          throw new BadRequestException(`Unknown event type "${eventType}"`);
        }
        if (enabled === false && SECURITY_CRITICAL_EVENT_TYPES.has(eventType)) {
          throw new BadRequestException(
            `Event type "${eventType}" is security-critical and cannot be disabled`,
          );
        }
      }
    }
  }
}
