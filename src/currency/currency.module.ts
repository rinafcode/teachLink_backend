import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CurrencyService } from './services/currency.service';
import { ExchangeRateService } from './services/exchange-rate.service';
import { CurrencyDetectionService } from './services/currency-detection.service';
import { CurrencyController } from './controllers/currency.controller';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [CurrencyService, ExchangeRateService, CurrencyDetectionService],
  controllers: [CurrencyController],
  exports: [CurrencyService, ExchangeRateService, CurrencyDetectionService],
})
export class CurrencyModule {}
