import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import { BackupRecord } from './entities/backup-record.entity';
import { RecoveryTest } from './entities/recovery-test.entity';

// Services
import { BackupService } from './backup.service';
import { DisasterRecoveryService } from './disaster-recovery/disaster-recovery.service';
import { DataIntegrityService } from './integrity/data-integrity.service';
import { RecoveryTestingService } from './testing/recovery-testing.service';
import { BackupMonitoringService } from './monitoring/backup-monitoring.service';

// Controller
import { BackupController } from './backup.controller';

// Processor
import { BackupQueueProcessor } from './processing/backup-queue.processor';

// External modules
import { MediaModule } from '../media/media.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([BackupRecord, RecoveryTest]),
    BullModule.registerQueue({
      name: 'backup-processing',
    }),
    MediaModule, // For FileStorageService
    MonitoringModule, // For AlertingService and MetricsCollectionService
  ],
  controllers: [BackupController],
  providers: [
    BackupService,
    DisasterRecoveryService,
    DataIntegrityService,
    RecoveryTestingService,
    BackupMonitoringService,
    BackupQueueProcessor,
  ],
  exports: [BackupService, DisasterRecoveryService],
})
export class BackupModule {}
