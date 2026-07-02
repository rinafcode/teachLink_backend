import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrencyModule } from '../currency/currency.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { Refund } from './entities/refund.entity';
import { PricingService } from './services/pricing.service';
import { PricingController } from './controllers/pricing.controller';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { ReconciliationTask } from './reconciliation/reconciliation.task';
import { ReconciliationController } from './reconciliation/reconciliation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Subscription, Invoice, Refund]),
    CurrencyModule,
    AuditLogModule,
  ],
  providers: [PricingService, ReconciliationService, ReconciliationTask],
  controllers: [PricingController, ReconciliationController],
  exports: [PricingService, CurrencyModule, ReconciliationService],
})
export class PaymentsModule {}
