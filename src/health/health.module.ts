import { Module } from '@nestjs/common';
import { ShutdownHealthController } from './controllers/shutdown-health.controller';
import { GracefulShutdownService } from '../common/services/graceful-shutdown.service';
import { RequestTrackerService } from '../common/services/request-tracker.service';
import { DatabaseShutdownService } from '../database/services/database-shutdown.service';
import { WorkerShutdownService } from '../workers/services/worker-shutdown.service';
import { ShutdownStateService } from '../common/services/shutdown-state.service';
import { PoolMonitorService } from '../database/pool/pool-monitor.service';
import { WorkerOrchestrationService } from '../workers/orchestration/worker-orchestration.service';

@Module({
  controllers: [ShutdownHealthController],
  providers: [
    GracefulShutdownService,
    RequestTrackerService,
    DatabaseShutdownService,
    WorkerShutdownService,
    ShutdownStateService,
    PoolMonitorService,
    WorkerOrchestrationService,
  ],
  exports: [
    GracefulShutdownService,
    RequestTrackerService,
    DatabaseShutdownService,
    WorkerShutdownService,
  ],
})
export class HealthModule {}
