import { Test } from '@nestjs/testing';
import { BackupModule } from './backup.module';
import { BackupService } from './backup.service';
import { DisasterRecoveryService } from './disaster-recovery/disaster-recovery.service';
import { DataIntegrityService } from './integrity/data-integrity.service';
import { RecoveryTestingService } from './testing/recovery-testing.service';
import { BackupMonitoringService } from './monitoring/backup-monitoring.service';

describe('BackupModule', () => {
  let backupService: BackupService;
  let disasterRecoveryService: DisasterRecoveryService;
  let dataIntegrityService: DataIntegrityService;
  let recoveryTestingService: RecoveryTestingService;
  let backupMonitoringService: BackupMonitoringService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [BackupModule],
    }).compile();

    backupService = moduleRef.get<BackupService>(BackupService);
    disasterRecoveryService = moduleRef.get<DisasterRecoveryService>(DisasterRecoveryService);
    dataIntegrityService = moduleRef.get<DataIntegrityService>(DataIntegrityService);
    recoveryTestingService = moduleRef.get<RecoveryTestingService>(RecoveryTestingService);
    backupMonitoringService = moduleRef.get<BackupMonitoringService>(BackupMonitoringService);
  });

  it('should be defined', () => {
    expect(backupService).toBeDefined();
    expect(disasterRecoveryService).toBeDefined();
    expect(dataIntegrityService).toBeDefined();
    expect(recoveryTestingService).toBeDefined();
    expect(backupMonitoringService).toBeDefined();
  });

  it('should provide BackupService with proper methods', () => {
    expect(typeof backupService.createFullBackup).toBe('function');
    expect(typeof backupService.createIncrementalBackup).toBe('function');
    expect(typeof backupService.restoreBackup).toBe('function');
  });

  it('should provide DisasterRecoveryService with proper methods', () => {
    expect(typeof disasterRecoveryService.checkRegionHealth).toBe('function');
    expect(typeof disasterRecoveryService.triggerFailover).toBe('function');
    expect(typeof disasterRecoveryService.triggerFailback).toBe('function');
  });

  it('should provide DataIntegrityService with proper methods', () => {
    expect(typeof dataIntegrityService.verifyBackup).toBe('function');
    expect(typeof dataIntegrityService.handleCorruptedBackup).toBe('function');
    expect(typeof dataIntegrityService.generateIntegrityReport).toBe('function');
  });

  it('should provide RecoveryTestingService with proper methods', () => {
    expect(typeof recoveryTestingService.runAutomatedRecoveryTest).toBe('function');
    expect(typeof recoveryTestingService.testDatabaseRecovery).toBe('function');
    expect(typeof recoveryTestingService.generateRecoveryTestingReport).toBe('function');
  });

  it('should provide BackupMonitoringService with proper methods', () => {
    expect(typeof backupMonitoringService.collectMetrics).toBe('function');
    expect(typeof backupMonitoringService.getCurrentMetrics).toBe('function');
    expect(typeof backupMonitoringService.generateMonitoringDashboard).toBe('function');
  });
});