import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { DebuggingModule } from './debugging/debugging.module';
import { CurrencyModule } from './currency/currency.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    SearchModule,
    DebuggingModule,
    CurrencyModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
