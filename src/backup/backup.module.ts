import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { DisasterRecoveryService } from './disaster-recovery/disaster-recovery.service';
import { DataIntegrityService } from './integrity/data-integrity.service';
import { RecoveryTestingService } from './testing/recovery-testing.service';
import { BackupMonitoringService } from './monitoring/backup-monitoring.service';

@Module({
  providers: [
    BackupService,
    DisasterRecoveryService,
    DataIntegrityService,
    RecoveryTestingService,
    BackupMonitoringService,
  ],
  exports: [BackupService],
})
export class BackupModule {}
