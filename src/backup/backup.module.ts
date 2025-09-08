import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { DisasterRecoveryService } from './disaster-recovery/disaster-recovery.service';
import { DataIntegrityService } from './integrity/data-integrity.service';
import { RecoveryTestingService } from './testing/recovery-testing.service';
import { BackupMonitoringService } from './monitoring/backup-monitoring.service';
import { BackupController } from './controllers/backup.controller';

/**
 * BackupModule provides comprehensive backup and disaster recovery capabilities
 * for the application, including automated backups, integrity verification,
 * disaster recovery procedures, and monitoring.
 */
@Module({
  imports: [],
  controllers: [BackupController],
  providers: [
    BackupService,
    DisasterRecoveryService,
    DataIntegrityService,
    RecoveryTestingService,
    BackupMonitoringService,
  ],
  exports: [
    BackupService,
    DisasterRecoveryService,
    DataIntegrityService,
    RecoveryTestingService,
    BackupMonitoringService,
  ],
})
export class BackupModule {}