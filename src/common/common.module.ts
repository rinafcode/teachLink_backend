import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TransactionHelperService } from './database/transaction-helper.service';
import { LogShipperService } from './services/log-shipper.service';

@Module({
  imports: [ConfigModule],
  providers: [TransactionHelperService, LogShipperService],
  exports: [TransactionHelperService, LogShipperService],
})
export class CommonModule {}
