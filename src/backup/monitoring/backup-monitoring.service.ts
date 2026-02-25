import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupRecord } from '../entities/backup-record.entity';
import { RecoveryTest } from '../entities/recovery-test.entity';
import { BackupStatus } from '../enums/backup-status.enum';
import { RecoveryTestStatus } from '../enums/recovery-test-status.enum';
import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';
import { AlertingService } from '../../monitoring/alerting/alerting.service';
import { Histogram, Counter } from 'prom-client';

@Injectable()
export class BackupMonitoringService {
  private readonly logger = new Logger(BackupMonitoringService.name);
  private backupDuration: Histogram;
  private backupTotal: Counter;

  constructor(
    @InjectRepository(BackupRecord)
    private readonly backupRepository: Repository<BackupRecord>,
    @InjectRepository(RecoveryTest)
    private readonly recoveryTestRepository: Repository<RecoveryTest>,
    private readonly metricsService: MetricsCollectionService,
    private readonly alertingService: AlertingService,
  ) {
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    const registry = this.metricsService.getRegistry();

    this.backupDuration = new Histogram({
      name: 'backup_duration_seconds',
      help: 'Duration of backup operations in seconds',
      labelNames: ['status'],
      buckets: [60, 300, 600, 900, 1200],
      registers: [registry],
    });

    this.backupTotal = new Counter({
      name: 'backup_total',
      help: 'Total number of backups',
      labelNames: ['status'],
      registers: [registry],
    });
  }

  async checkBackupHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check last backup was successful
    const lastBackup = await this.backupRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    if (!lastBackup) {
      issues.push('No backups found');
    } else {
      if (lastBackup.status === BackupStatus.FAILED) {
        issues.push(`Last backup failed: ${lastBackup.errorMessage}`);
      }

      // Check last backup was within 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      if (lastBackup.createdAt < sevenDaysAgo) {
        issues.push('Last backup is older than 7 days');
      }

      // Check replication
      if (lastBackup.status === BackupStatus.COMPLETED && !lastBackup.replicatedStorageKey) {
        issues.push('Last backup was not replicated to secondary region');
      }
    }

    // Check recent recovery tests
    const lastTest = await this.recoveryTestRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    if (lastTest && lastTest.status === RecoveryTestStatus.FAILED) {
      issues.push(`Last recovery test failed: ${lastTest.errorMessage}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  async recordBackupMetrics(backupId: string, duration: number): Promise<void> {
    const backup = await this.backupRepository.findOne({
      where: { id: backupId },
    });

    if (!backup) {
      return;
    }

    const status = backup.status === BackupStatus.COMPLETED ? 'success' : 'failure';

    this.backupDuration.observe({ status }, duration / 1000);
    this.backupTotal.inc({ status });

    this.logger.log(`Recorded backup metrics for ${backupId}: ${duration}ms, status: ${status}`);
  }
}
