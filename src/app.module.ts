import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';

// Core imports from main
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './users/entities/user.entity';

// Gamification Module & Entities
import { GamificationModule } from './gamification/gamification.module';
import { PointTransaction } from './gamification/entities/point-transaction.entity';
import { UserProgress } from './gamification/entities/user-progress.entity';
import { Badge } from './gamification/entities/badge.entity';
import { UserBadge } from './gamification/entities/user-badge.entity';
import { Challenge } from './gamification/entities/challenge.entity';
import { UserChallenge } from './gamification/entities/user-challenge.entity';

// Email Marketing Module & Entities
import { EmailMarketingModule } from './email-marketing/email-marketing.module';
import { Campaign } from './email-marketing/entities/campaign.entity';
import { EmailTemplate } from './email-marketing/entities/email-template.entity';
import { AutomationWorkflow } from './email-marketing/entities/automation-workflow.entity';
import { AutomationTrigger } from './email-marketing/entities/automation-trigger.entity';
import { AutomationAction } from './email-marketing/entities/automation-action.entity';
import { Segment } from './email-marketing/entities/segment.entity';
import { SegmentRule } from './email-marketing/entities/segment-rule.entity';
import { EmailEvent } from './email-marketing/entities/email-event.entity';
import { ABTest as EmailABTest } from './email-marketing/entities/ab-test.entity';
import { ABTestVariant } from './email-marketing/entities/ab-test-variant.entity';
import { CampaignRecipient } from './email-marketing/entities/campaign-recipient.entity';
import { EmailSubscription } from './email-marketing/entities/email-subscription.entity';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Database
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'teachlink',
      entities: [
        // Core
        User,
        
        // Gamification Entities
        PointTransaction,
        UserProgress,
        Badge,
        UserBadge,
        Challenge,
        UserChallenge,

        // Email Marketing Entities
        Campaign,
        EmailTemplate,
        AutomationWorkflow,
        AutomationTrigger,
        AutomationAction,
        Segment,
        SegmentRule,
        EmailEvent,
        EmailABTest,
        ABTestVariant,
        CampaignRecipient,
        EmailSubscription,
      ],
      synchronize: true, // Should be false in production
    }),

    // Infrastructure for Email Marketing
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),

    // Feature Modules
    GamificationModule,
    EmailMarketingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }