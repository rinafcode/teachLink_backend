import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { PaymentsService } from './payments.service';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { StripeService } from './providers/stripe.service';
import { WebhookController } from './webhooks/webhook.controller';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Subscription])],
  providers: [PaymentsService, SubscriptionsService, StripeService],
  controllers: [WebhookController, PaymentsController],
  exports: [PaymentsService, SubscriptionsService, StripeService],
})
export class PaymentsModule {} 