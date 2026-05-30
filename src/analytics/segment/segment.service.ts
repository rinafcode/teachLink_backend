import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Analytics } from '@segment/analytics-node';

export interface SegmentTrackPayload {
  userId: string;
  event: string;
  properties?: Record<string, unknown>;
  anonymousId?: string;
}

export interface SegmentIdentifyPayload {
  userId: string;
  traits?: Record<string, unknown>;
  anonymousId?: string;
}

@Injectable()
export class SegmentService implements OnModuleDestroy {
  private readonly logger = new Logger(SegmentService.name);
  private readonly client: Analytics | null;

  constructor(private readonly config: ConfigService) {
    const writeKey = this.config.get<string>('SEGMENT_WRITE_KEY');
    if (writeKey) {
      this.client = new Analytics({ writeKey });
      this.logger.log('Segment SDK initialized');
    } else {
      this.client = null;
      this.logger.warn('SEGMENT_WRITE_KEY not set — Segment events will be no-ops');
    }
  }

  track(payload: SegmentTrackPayload): void {
    if (!this.client) return;
    this.client.track({
      userId: payload.userId,
      event: payload.event,
      properties: payload.properties,
      ...(payload.anonymousId ? { anonymousId: payload.anonymousId } : {}),
    });
  }

  identify(payload: SegmentIdentifyPayload): void {
    if (!this.client) return;
    this.client.identify({
      userId: payload.userId,
      traits: payload.traits,
      ...(payload.anonymousId ? { anonymousId: payload.anonymousId } : {}),
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.closeAndFlush();
    }
  }
}
