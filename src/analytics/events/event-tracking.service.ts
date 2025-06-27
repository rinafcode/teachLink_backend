/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';

interface UserEvent {
  userId: string;
  courseId?: string;
  eventType: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class EventTrackingService {
  private readonly events: UserEvent[] = [];

  // Save user event (for demo, using in-memory array, replace with DB)
  async trackEvent(eventData: UserEvent): Promise<{ success: boolean }> {
    // Basic validation (extend as needed)
    if (!eventData.userId || !eventData.eventType) {
      throw new Error('Missing required event data');
    }
    eventData.timestamp = new Date(eventData.timestamp || Date.now());

    this.events.push(eventData);
    // TODO: Persist to DB
    return { success: true };
  }

  // Retrieve events for reports or metrics
  async getEvents(filter?: Partial<UserEvent>): Promise<UserEvent[]> {
    // Filter events based on criteria (simplified)
    if (!filter) return this.events;

    return this.events.filter((event) => {
      return Object.entries(filter).every(
        ([key, value]) => event[key] === value,
      );
    });
  }
}
