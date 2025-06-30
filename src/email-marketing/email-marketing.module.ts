import { Module } from '@nestjs/common';
import { EmailMarketingService } from './email-marketing.service';
import { AutomationService } from './automation/automation.service';
import { SegmentationService } from './segmentation/segmentation.service';
import { EmailAnalyticsService } from './analytics/email-analytics.service';
import { TemplateManagementService } from './templates/template-management.service';

@Module({
  providers: [
    EmailMarketingService,
    AutomationService,
    SegmentationService,
    EmailAnalyticsService,
    TemplateManagementService,
  ],
  exports: [
    EmailMarketingService,
    AutomationService,
    SegmentationService,
    EmailAnalyticsService,
    TemplateManagementService,
  ],
})
export class EmailMarketingModule {}
