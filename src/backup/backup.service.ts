import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackupRecord } from './entities/backup-record.entity';
import { BackupStatus } from './enums/backup-status.enum';
import { BackupType } from './enums/backup-type.enum';
import { Region } from './enums/region.enum';
import { BackupResponseDto } from './dto/backup-response.dto';
import { BackupJobData } from './interfaces/backup.interfaces';
import { AlertingService } from '../monitoring/alerting/alerting.service';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly retentionDays: number;

  constructor(
    @InjectRepository(BackupRecord)
    private readonly backupRepository: Repository<BackupRecord>,
    @InjectQueue('backup-processing')
    private readonly backupQueue: Queue,
    private readonly configService: ConfigService,
    private readonly alertingService: AlertingService,
    private readonly metricsService: MetricsCollectionService,
  ) {
    this.retentionDays = this.configService.get<number>(
      'BACKUP_RETENTION_DAYS',
      30,
    );
  }

  /**
   * Scheduled weekly backup (every Sunday at 2 AM UTC)
   */
  @Cron('0 2 * * 0', {
    name: 'weekly-database-backup',
    timeZone: 'UTC',
  })
  async handleScheduledBackup(): Promise<void> {
    this.logger.log('Starting scheduled weekly backup');

    try {
      const region =
        (this.configService.get<string>(
          'BACKUP_PRIMARY_REGION',
        ) as Region) || Region.US_EAST_1;
      const databaseName = this.configService.get<string>(
        'DB_DATABASE',
        'teachlink',
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.retentionDays);

      const backupRecord = this.backupRepository.create({
        backupType: BackupType.FULL,
        status: BackupStatus.PENDING,
        region,
        databaseName,
        storageKey: '',
        expiresAt,
        metadata: {
          startTime: new Date(),
        },
      });

      await this.backupRepository.save(backupRecord);

      // Queue backup job
      await this.backupQueue.add(
        'create-backup',
        {
          backupRecordId: backupRecord.id,
          backupType: BackupType.FULL,
          region,
          databaseName,
        } as BackupJobData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10000,
          },
          timeout: 3600000, // 1 hour timeout
        },
      );

      this.logger.log(`Scheduled backup ${backupRecord.id} queued`);
    } catch (error) {
      this.logger.error('Failed to initiate scheduled backup:', error);
      this.alertingService.sendAlert(
        'BACKUP_SCHEDULED_FAILED',
        `Scheduled backup failed: ${error.message}`,
        'CRITICAL',
      );
    }
  }

  /**
   * Cleanup expired backups (daily at 3 AM UTC)
   */
  @Cron('0 3 * * *', {
    name: 'cleanup-expired-backups',
    timeZone: 'UTC',
  })
  async handleBackupCleanup(): Promise<void> {
    this.logger.log('Starting backup cleanup job');

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - this.retentionDays);

    const expiredBackups = await this.backupRepository.find({
      where: {
        createdAt: LessThan(expirationDate),
        status: BackupStatus.COMPLETED,
      },
    });

    this.logger.log(
      `Found ${expiredBackups.length} expired backups to cleanup`,
    );

    for (const backup of expiredBackups) {
      await this.backupQueue.add(
        'delete-backup',
        { backupRecordId: backup.id },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
    }
  }

  async getLatestBackup(region?: Region): Promise<BackupRecord | null> {
    const where: any = {
      status: BackupStatus.COMPLETED,
      integrityVerified: true,
    };
    if (region) {
      where.region = region;
    }

    return this.backupRepository.findOne({
      where,
      order: { completedAt: 'DESC' },
    });
  }

  async updateBackupStatus(
    backupId: string,
    status: BackupStatus,
    updates: Partial<BackupRecord> = {},
  ): Promise<void> {
    await this.backupRepository.update(backupId, {
      status,
      ...updates,
      updatedAt: new Date(),
    });

    if (status === BackupStatus.COMPLETED) {
      this.alertingService.sendAlert(
        'BACKUP_COMPLETED',
        `Backup ${backupId} completed successfully`,
        'INFO',
      );
    } else if (status === BackupStatus.FAILED) {
      this.alertingService.sendAlert(
        'BACKUP_FAILED',
        `Backup ${backupId} failed: ${updates.errorMessage}`,
        'CRITICAL',
      );
    }
  }

  toResponseDto(backup: BackupRecord): BackupResponseDto {
    return {
      id: backup.id,
      backupType: backup.backupType,
      status: backup.status,
      region: backup.region,
      databaseName: backup.databaseName,
      backupSizeBytes: backup.backupSizeBytes,
      integrityVerified: backup.integrityVerified,
      completedAt: backup.completedAt,
      expiresAt: backup.expiresAt,
      createdAt: backup.createdAt,
      metadata: backup.metadata,
    };
  }
}
