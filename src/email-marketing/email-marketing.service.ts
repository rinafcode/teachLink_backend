import { Injectable } from '@nestjs/common';
import { TemplateManagementService } from './templates/template-management.service';
import { AutomationService } from './automation/automation.service';
import { SegmentationService } from './segmentation/segmentation.service';
import { EmailAnalyticsService } from './analytics/email-analytics.service';

interface Campaign {
  id: string;
  name: string;
  templateId: string;
  segmentId: string;
  status: 'draft' | 'scheduled' | 'sent';
  abTestGroup?: string;
  createdAt: Date;
}

@Injectable()
export class EmailMarketingService {
  private campaigns: Campaign[] = [];

  constructor(
    private readonly templateService: TemplateManagementService,
    private readonly automationService: AutomationService,
    private readonly segmentationService: SegmentationService,
    private readonly analyticsService: EmailAnalyticsService,
  ) {}

  createCampaign(name: string, templateId: string, segmentId: string, abTestGroup?: string): Campaign {
    const campaign: Campaign = {
      id: Math.random().toString(36).substring(2),
      name,
      templateId,
      segmentId,
      status: 'draft',
      abTestGroup,
      createdAt: new Date(),
    };
    this.campaigns.push(campaign);
    return campaign;
  }

  sendCampaign(campaignId: string, users: any[]): boolean {
    const campaign = this.campaigns.find(c => c.id === campaignId);
    if (!campaign) return false;
    const template = this.templateService.getTemplate(campaign.templateId);
    if (!template) return false;
    const segmentUsers = this.segmentationService.applySegment(campaign.segmentId, users);
    // Here, send emails to segmentUsers using the template
    campaign.status = 'sent';
    // Track send event (not implemented in analytics for brevity)
    return true;
  }

  abTestCampaign(name: string, templateIds: string[], segmentId: string, users: any[]): Campaign[] {
    // Split users into groups for A/B test
    const half = Math.ceil(users.length / 2);
    const groupA = users.slice(0, half);
    const groupB = users.slice(half);
    const campaigns: Campaign[] = [];
    [groupA, groupB].forEach((group, idx) => {
      const campaign = this.createCampaign(
        `${name} - Group ${idx === 0 ? 'A' : 'B'}`,
        templateIds[idx],
        segmentId,
        idx === 0 ? 'A' : 'B',
      );
      this.sendCampaign(campaign.id, group);
      campaigns.push(campaign);
    });
    return campaigns;
  }

  getCampaignAnalytics(campaignId: string) {
    return this.analyticsService.generateReport(campaignId);
  }

  listCampaigns(): Campaign[] {
    return this.campaigns;
  }
}
