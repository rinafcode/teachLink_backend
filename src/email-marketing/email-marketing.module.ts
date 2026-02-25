import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Services
import { EmailMarketingService } from './email-marketing.service';
import { AutomationService } from './automation/automation.service';
import { SegmentationService } from './segmentation/segmentation.service';
import { EmailAnalyticsService } from './analytics/email-analytics.service';
import { TemplateManagementService } from './templates/template-management.service';
import { ABTestingService } from './ab-testing/ab-testing.service';
import { EmailSenderService } from './sender/email-sender.service';

// Controllers
import { EmailMarketingController } from './email-marketing.controller';
import { TemplateController } from './templates/template.controller';
import { AutomationController } from './automation/automation.controller';
import { SegmentController } from './segmentation/segment.controller';
import { EmailAnalyticsController } from './analytics/email-analytics.controller';
import { ABTestingController } from './ab-testing/ab-testing.controller';
import { TrackingController } from './tracking/tracking.controller';

// Entities
import { Campaign } from './entities/campaign.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { AutomationWorkflow } from './entities/automation-workflow.entity';
import { AutomationTrigger } from './entities/automation-trigger.entity';
import { AutomationAction } from './entities/automation-action.entity';
import { Segment } from './entities/segment.entity';
import { SegmentRule } from './entities/segment-rule.entity';
import { EmailEvent } from './entities/email-event.entity';
import { ABTest } from './entities/ab-test.entity';
import { ABTestVariant } from './entities/ab-test-variant.entity';
import { CampaignRecipient } from './entities/campaign-recipient.entity';
import { EmailSubscription } from './entities/email-subscription.entity';

// Processors (Bull Queue)
import { EmailQueueProcessor } from './processors/email-queue.processor';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Campaign,
      EmailTemplate,
      AutomationWorkflow,
      AutomationTrigger,
      AutomationAction,
      Segment,
      SegmentRule,
      EmailEvent,
      ABTest,
      ABTestVariant,
      CampaignRecipient,
      EmailSubscription,
    ]),
    BullModule.registerQueue({
      name: 'email-marketing',
    }),
  ],
  controllers: [
    EmailMarketingController,
    TemplateController,
    AutomationController,
    SegmentController,
    EmailAnalyticsController,
    ABTestingController,
    TrackingController,
  ],
  providers: [
    EmailMarketingService,
    AutomationService,
    SegmentationService,
    EmailAnalyticsService,
    TemplateManagementService,
    ABTestingService,
    EmailSenderService,
    EmailQueueProcessor,
  ],
  exports: [
    EmailMarketingService,
    AutomationService,
    SegmentationService,
    EmailAnalyticsService,
    TemplateManagementService,
    ABTestingService,
  ],
})
export class EmailMarketingModule { }
