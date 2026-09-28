import { Module } from '@nestjs/common';
import { ShutdownHealthController } from './controllers/shutdown-health.controller';
import { PaymentProviderHealthController } from './controllers/payment-provider-health.controller';
import { GracefulShutdownService } from '../common/services/graceful-shutdown.service';
import { RequestTrackerService } from '../common/services/request-tracker.service';
import { DatabaseShutdownService } from '../database/services/database-shutdown.service';
import { WorkerShutdownService } from '../workers/services/worker-shutdown.service';
import { ShutdownStateService } from '../common/services/shutdown-state.service';
import { PoolMonitorService } from '../database/pool/pool-monitor.service';
import { WorkerOrchestrationService } from '../workers/orchestration/worker-orchestration.service';
import { HealthIndicatorsService } from './health-indicators.service';
import { PaymentProviderCircuitBreakerService } from '../payments/services/payment-provider-circuit-breaker.service';

@Module({
  controllers: [ShutdownHealthController, PaymentProviderHealthController],
  providers: [
    GracefulShutdownService,
    RequestTrackerService,
    DatabaseShutdownService,
    WorkerShutdownService,
    ShutdownStateService,
    PoolMonitorService,
    WorkerOrchestrationService,
    HealthIndicatorsService,
    PaymentProviderCircuitBreakerService,
  ],
  exports: [
    GracefulShutdownService,
    RequestTrackerService,
    DatabaseShutdownService,
    WorkerShutdownService,
    HealthIndicatorsService,
    PaymentProviderCircuitBreakerService,
  ],
})
export class HealthModule {}
