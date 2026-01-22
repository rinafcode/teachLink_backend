import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import { EmailEvent } from '../entities/email-event.entity';
import { Campaign } from '../entities/campaign.entity';
import { EmailEventType } from '../enums/email-event-type.enum';

export interface CampaignMetrics {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
}

export interface TimeSeriesData {
    date: string;
    opens: number;
    clicks: number;
    bounces: number;
}

@Injectable()
export class EmailAnalyticsService {
    constructor(
        @InjectRepository(EmailEvent)
        private readonly eventRepository: Repository<EmailEvent>,
        @InjectRepository(Campaign)
        private readonly campaignRepository: Repository<Campaign>,
    ) { }

    /**
     * Record an email event
     */
    async recordEvent(
        campaignId: string,
        recipientId: string,
        eventType: EmailEventType,
        metadata?: Record<string, any>,
    ): Promise<EmailEvent> {
        const event = this.eventRepository.create({
            campaignId,
            recipientId,
            eventType,
            metadata,
            occurredAt: new Date(),
        });

        return this.eventRepository.save(event);
    }

    /**
     * Get campaign metrics
     */
    async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
        const campaign = await this.campaignRepository.findOne({
            where: { id: campaignId },
        });

        if (!campaign) {
            throw new NotFoundException(`Campaign ${campaignId} not found`);
        }

        const sent = campaign.totalRecipients || 0;

        const [delivered, opened, clicked, bounced, unsubscribed] = await Promise.all([
            this.countEvents(campaignId, EmailEventType.DELIVERED),
            this.countUniqueEvents(campaignId, EmailEventType.OPENED),
            this.countUniqueEvents(campaignId, EmailEventType.CLICKED),
            this.countEvents(campaignId, EmailEventType.BOUNCED),
            this.countEvents(campaignId, EmailEventType.UNSUBSCRIBED),
        ]);

        return {
            sent,
            delivered,
            opened,
            clicked,
            bounced,
            unsubscribed,
            openRate: sent > 0 ? (opened / sent) * 100 : 0,
            clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
            bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
        };
    }

    /**
     * Get time series data for a campaign
     */
    async getCampaignTimeSeries(
        campaignId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<TimeSeriesData[]> {
        const events = await this.eventRepository.find({
            where: {
                campaignId,
                occurredAt: Between(startDate, endDate),
            },
            order: { occurredAt: 'ASC' },
        });

        const dataMap = new Map<string, TimeSeriesData>();

        for (const event of events) {
            const dateKey = event.occurredAt.toISOString().split('T')[0];

            if (!dataMap.has(dateKey)) {
                dataMap.set(dateKey, { date: dateKey, opens: 0, clicks: 0, bounces: 0 });
            }

            const data = dataMap.get(dateKey)!;

            if (event.eventType === EmailEventType.OPENED) data.opens++;
            if (event.eventType === EmailEventType.CLICKED) data.clicks++;
            if (event.eventType === EmailEventType.BOUNCED) data.bounces++;
        }

        return Array.from(dataMap.values());
    }

    /**
     * Get link click analytics
     */
    async getLinkAnalytics(campaignId: string): Promise<Array<{
        url: string;
        clicks: number;
        uniqueClicks: number;
    }>> {
        const clickEvents = await this.eventRepository.find({
            where: { campaignId, eventType: EmailEventType.CLICKED },
        });

        const linkMap = new Map<string, { clicks: number; recipients: Set<string> }>();

        for (const event of clickEvents) {
            const url = event.metadata?.url || 'unknown';

            if (!linkMap.has(url)) {
                linkMap.set(url, { clicks: 0, recipients: new Set() });
            }

            const data = linkMap.get(url)!;
            data.clicks++;
            data.recipients.add(event.recipientId);
        }

        return Array.from(linkMap.entries()).map(([url, data]) => ({
            url,
            clicks: data.clicks,
            uniqueClicks: data.recipients.size,
        }));
    }

    /**
     * Get overall email marketing stats
     */
    async getOverallStats(startDate?: Date, endDate?: Date): Promise<{
        totalCampaigns: number;
        totalEmailsSent: number;
        averageOpenRate: number;
        averageClickRate: number;
    }> {
        const query = this.campaignRepository.createQueryBuilder('campaign')
            .where('campaign.sentAt IS NOT NULL');

        if (startDate && endDate) {
            query.andWhere('campaign.sentAt BETWEEN :start AND :end', {
                start: startDate,
                end: endDate,
            });
        }

        const campaigns = await query.getMany();

        const totalCampaigns = campaigns.length;
        const totalEmailsSent = campaigns.reduce((sum, c) => sum + (c.totalRecipients || 0), 0);

        let totalOpenRate = 0;
        let totalClickRate = 0;

        for (const campaign of campaigns) {
            const metrics = await this.getCampaignMetrics(campaign.id);
            totalOpenRate += metrics.openRate;
            totalClickRate += metrics.clickRate;
        }

        return {
            totalCampaigns,
            totalEmailsSent,
            averageOpenRate: totalCampaigns > 0 ? totalOpenRate / totalCampaigns : 0,
            averageClickRate: totalCampaigns > 0 ? totalClickRate / totalCampaigns : 0,
        };
    }

    // Helper methods
    private async countEvents(campaignId: string, eventType: EmailEventType): Promise<number> {
        return this.eventRepository.count({ where: { campaignId, eventType } });
    }

    private async countUniqueEvents(campaignId: string, eventType: EmailEventType): Promise<number> {
        const result = await this.eventRepository
            .createQueryBuilder('event')
            .select('COUNT(DISTINCT event.recipientId)', 'count')
            .where('event.campaignId = :campaignId', { campaignId })
            .andWhere('event.eventType = :eventType', { eventType })
            .getRawOne();

        return parseInt(result?.count || '0', 10);
    }
}
