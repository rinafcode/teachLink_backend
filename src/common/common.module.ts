import { Module } from '@nestjs/common';
import { TransactionHelperService } from './database/transaction-helper.service';

@Module({
  providers: [TransactionHelperService],
  exports: [TransactionHelperService],
})
export class CommonModule {}