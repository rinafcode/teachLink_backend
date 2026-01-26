import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WebhookController } from './webhooks/webhook.controller';
import { WebhookService } from './webhooks/webhook.service';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { SubscriptionJobProcessor } from './subscriptions/subscription-job.processor';
import { StripeService } from './providers/stripe.service';
import { ProviderFactoryService } from './providers/provider-factory.service';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { Refund } from './entities/refund.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Subscription, Invoice, Refund]),
    BullModule.registerQueue({
      name: 'subscriptions',
    }),
    UsersModule,
  ],
  controllers: [PaymentsController, WebhookController],
  providers: [
    PaymentsService,
    WebhookService,
    SubscriptionsService,
    SubscriptionJobProcessor,
    StripeService,
    ProviderFactoryService,
  ],
  exports: [PaymentsService, ProviderFactoryService],
})
export class PaymentsModule {}