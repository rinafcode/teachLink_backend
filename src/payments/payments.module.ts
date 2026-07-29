import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrencyModule } from '../currency/currency.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { IdempotencyModule } from '../common/modules/idempotency.module';
import { QueueModule } from '../queues/queue.module';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { Refund } from './entities/refund.entity';
import { PricingService } from './services/pricing.service';
import { PricingController } from './controllers/pricing.controller';
import { PaymentReconciliationJob } from './reconciliation/reconciliation.service';
import { PaymentReconciliationController } from './reconciliation/reconciliation.controller';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { SubscriptionsController } from './subscriptions/subscriptions.controller';
import { PaymentProviderService } from './providers/payment-provider.service';
import { StripeProvider } from './providers/stripe.provider';

/**
 * PaymentsModule
 *
 * Issue #824 — imports IdempotencyModule so that every @Idempotent() decorator
 * in any controller (Payments, PaymentMethods, Subscriptions, Payouts) is
 * honored. The IdempotencyInterceptor is registered as APP_INTERCEPTOR in
 * AppModule so a single instance covers all routes, instead of being
 * redeclared per-module.
 *
 * Issue #856 — imports AuditLogModule so PaymentReconciliationJob can log
 * PAYMENT_RECONCILIATION_MISMATCH audit events.
 *
 * Issue #1007 — registers SubscriptionsService, SubscriptionsController, and
 * PaymentProviderService so that prorated upgrade charges and downgrade credits
 * are wired into the DI container.
 * Issue #1005 — adds StripeProvider and QueueModule for subscription pause/resume
 * functionality with provider billing suspension.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Subscription, Invoice, Refund]),
    CurrencyModule,
    AuditLogModule,
    IdempotencyModule,
    HttpModule,
    QueueModule,
  ],
  providers: [
    PricingService,
    PaymentReconciliationJob,
    StripeProvider,
    {
      provide: 'IPaymentProvider',
      useClass: StripeProvider,
    },
  ],
  providers: [PricingService, PaymentReconciliationJob, SubscriptionsService, PaymentProviderService],
  controllers: [PricingController, PaymentReconciliationController, SubscriptionsController],
  exports: [PricingService, CurrencyModule, IdempotencyModule, PaymentReconciliationJob, SubscriptionsService, PaymentProviderService],
  controllers: [PricingController, PaymentReconciliationController],
  exports: [
    PricingService,
    CurrencyModule,
    IdempotencyModule,
    PaymentReconciliationJob,
    'IPaymentProvider',
  ],
})
export class PaymentsModule {}
