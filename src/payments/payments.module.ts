import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WebhookController } from './webhooks/webhook.controller';
import { WebhookManagementController } from './webhooks/webhook-management.controller';
import { WebhookService } from './webhooks/webhook.service';
import { WebhookQueueService } from './webhooks/webhook-queue.service';
import { WebhookRetryProcessor } from './webhooks/webhook-retry.processor';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { SubscriptionJobProcessor } from './subscriptions/subscription-job.processor';
import { StripeService } from './providers/stripe.service';
import { ProviderFactoryService } from './providers/provider-factory.service';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { Refund } from './entities/refund.entity';
import { WebhookRetry } from './webhooks/entities/webhook-retry.entity';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { TransactionService } from '../common/database/transaction.service';
import { TransactionHelperService } from '../common/database/transaction-helper.service';
import { IdempotencyService } from '../common/services/idempotency.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Subscription, Invoice, Refund, User, WebhookRetry]),
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.SUBSCRIPTIONS,
      },
      {
        name: QUEUE_NAMES.WEBHOOKS,
      },
    ),
    UsersModule,
  ],
  controllers: [PaymentsController, WebhookController, WebhookManagementController],
  providers: [
    PaymentsService,
    WebhookService,
    WebhookQueueService,
    WebhookRetryProcessor,
    SubscriptionsService,
    SubscriptionJobProcessor,
    StripeService,
    ProviderFactoryService,
    TransactionService,
    TransactionHelperService,
    IdempotencyService,
  ],
  exports: [PaymentsService, ProviderFactoryService, WebhookQueueService, IdempotencyService],
})
export class PaymentsModule {}
