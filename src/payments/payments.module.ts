import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrencyModule } from '../currency/currency.module';
import { IdempotencyModule } from '../common/modules/idempotency.module';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { Refund } from './entities/refund.entity';
import { PricingService } from './services/pricing.service';
import { PricingController } from './controllers/pricing.controller';

/**
 * PaymentsModule
 *
 * Issue #824 — imports IdempotencyModule so that every @Idempotent() decorator
 * in any controller (Payments, PaymentMethods, Subscriptions, Payouts) is
 * honored. The IdempotencyInterceptor is registered as APP_INTERCEPTOR in
 * AppModule so a single instance covers all routes, instead of being
 * redeclared per-module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Subscription, Invoice, Refund]),
    CurrencyModule,
    IdempotencyModule,
  ],
  providers: [PricingService],
  controllers: [PricingController],
  exports: [PricingService, CurrencyModule, IdempotencyModule],
})
export class PaymentsModule {}
