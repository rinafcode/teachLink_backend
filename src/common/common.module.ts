import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TransactionHelperService } from './database/transaction-helper.service';
import { LogShipperService } from './services/log-shipper.service';
import { EnhancedCircuitBreakerService } from './services/circuit-breaker.service';
import { CircuitBreakerController } from './controllers/circuit-breaker.controller';

/**
 * Registers the common module.
 */
@Module({
  imports: [ConfigModule],
  controllers: [CircuitBreakerController],
  providers: [TransactionHelperService, LogShipperService, EnhancedCircuitBreakerService],
  exports: [TransactionHelperService, LogShipperService, EnhancedCircuitBreakerService],
})
export class CommonModule {}
