import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrencyModule } from '../currency/currency.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { Refund } from './entities/refund.entity';
import { PricingService } from './services/pricing.service';
import { PricingController } from './controllers/pricing.controller';
import { PaymentReconciliationJob } from './reconciliation/reconciliation.service';
import { PaymentReconciliationController } from './reconciliation/reconciliation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Subscription, Invoice, Refund]),
    CurrencyModule,
    AuditLogModule,
    HttpModule,
  ],
  providers: [PricingService, PaymentReconciliationJob],
  controllers: [PricingController, PaymentReconciliationController],
  exports: [PricingService, CurrencyModule, PaymentReconciliationJob],
})
export class PaymentsModule {}
