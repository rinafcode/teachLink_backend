import { Module } from '@nestjs/common';
import { RetryStrategyService } from './retry-strategy.service';

@Module({
  providers: [RetryStrategyService],
  exports: [RetryStrategyService],
})
export class RetryStrategyModule {}
