import { Injectable } from '@nestjs/common';

export type NotificationPreferences = {
  [type: string]: boolean;
};

@Injectable()
export class NotificationPreferencesService {
  private preferences: Map<string, NotificationPreferences> = new Map();

  getPreferences(userId: string): NotificationPreferences {
    return this.preferences.get(userId) || {};
  }

  setPreferences(userId: string, prefs: NotificationPreferences) {
    this.preferences.set(userId, prefs);
  }

  isEnabled(userId: string, type: string): boolean {
    const prefs = this.getPreferences(userId);
    return prefs[type] !== false; // default to true if not set
  }
}
