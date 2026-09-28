import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TransactionHelperService } from './database/transaction-helper.service';
import { LogShipperService } from './services/log-shipper.service';
import { EnhancedCircuitBreakerService } from './services/circuit-breaker.service';
import { PaginationService } from './services/pagination.service';
import { CircuitBreakerController } from './controllers/circuit-breaker.controller';

/**
 * Registers the common module.
 */
@Module({
  imports: [ConfigModule],
  controllers: [CircuitBreakerController],
  providers: [
    TransactionHelperService,
    LogShipperService,
    EnhancedCircuitBreakerService,
    PaginationService,
  ],
  exports: [
    TransactionHelperService,
    LogShipperService,
    EnhancedCircuitBreakerService,
    PaginationService,
  ],
})
export class CommonModule {}
