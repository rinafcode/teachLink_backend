import { Injectable } from '@nestjs/common';

interface EmailEvent {
  campaignId: string;
  userId: string;
  type: 'open' | 'click' | 'conversion';
  timestamp: Date;
}

@Injectable()
export class EmailAnalyticsService {
  private events: EmailEvent[] = [];

  trackEvent(event: EmailEvent) {
    this.events.push(event);
  }

  getEventsByCampaign(campaignId: string): EmailEvent[] {
    return this.events.filter((e) => e.campaignId === campaignId);
  }

  getStats(campaignId: string) {
    const events = this.getEventsByCampaign(campaignId);
    return {
      opens: events.filter((e) => e.type === 'open').length,
      clicks: events.filter((e) => e.type === 'click').length,
      conversions: events.filter((e) => e.type === 'conversion').length,
    };
  }

  generateReport(campaignId: string) {
    const stats = this.getStats(campaignId);
    return {
      campaignId,
      ...stats,
    };
  }
}
