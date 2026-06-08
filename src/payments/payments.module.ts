import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrencyModule } from '../currency/currency.module';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { Refund } from './entities/refund.entity';
import { PricingService } from './services/pricing.service';
import { PricingController } from './controllers/pricing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Subscription, Invoice, Refund]),
    CurrencyModule,
  ],
  providers: [PricingService],
  controllers: [PricingController],
  exports: [PricingService, CurrencyModule],
})
export class PaymentsModule {}
