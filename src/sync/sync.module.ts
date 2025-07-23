import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { BullModule } from "@nestjs/bull"
import { ScheduleModule } from "@nestjs/schedule"
import { DataSyncService } from "./services/data-sync.service"
import { DataConsistencyService } from "./services/data-consistency.service"
import { ConflictResolutionService } from "./services/conflict-resolution.service"
import { CacheInvalidationService } from "./services/cache-invalidation.service"
import { ReplicationService } from "./services/replication.service"
import { IntegrityMonitoringService } from "./services/integrity-monitoring.service"
import { SyncController } from "./controllers/sync.controller"
import { SyncEvent } from "./entities/sync-event.entity"
import { ConflictLog } from "./entities/conflict-log.entity"
import { ReplicationStatus } from "./entities/replication-status.entity"
import { IntegrityCheck } from "./entities/integrity-check.entity"
import { SyncProcessor } from "./processors/sync.processor"

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([SyncEvent, ConflictLog, ReplicationStatus, IntegrityCheck]),
    BullModule.registerQueue({
      name: "sync-queue",
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number.parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
  ],
  controllers: [SyncController],
  providers: [
    DataSyncService,
    DataConsistencyService,
    ConflictResolutionService,
    CacheInvalidationService,
    ReplicationService,
    IntegrityMonitoringService,
    SyncProcessor,
  ],
  exports: [
    DataSyncService,
    DataConsistencyService,
    ConflictResolutionService,
    CacheInvalidationService,
    ReplicationService,
    IntegrityMonitoringService,
  ],
})
export class SyncModule {}
