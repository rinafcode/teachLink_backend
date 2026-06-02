import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource, IsNull, Not } from 'typeorm';
import { ArchivedData } from './entities/archived-data.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { Notification } from '../notifications/entities/notification.entity';

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @InjectRepository(ArchivedData)
    private readonly archiveRepo: Repository<ArchivedData>,
  ) {}

  /**
   * Purge soft-deleted records that are older than the retention threshold.
   */
  async purgeSoftDeleted(entityClass: any, entityName: string): Promise<number> {
    const days = this.configService.get<number>('retention.softDeleteRetentionDays', 30);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    this.logger.log(`Purging soft-deleted ${entityName} records older than ${cutoff.toISOString()}`);

    const repository = this.dataSource.getRepository(entityClass);
    
    // Find records to purge
    const records = await repository.find({
      where: {
        deletedAt: LessThan(cutoff),
      },
      take: this.configService.get<number>('retention.batchSize', 1000),
      withDeleted: true,
    });

    if (records.length === 0) {
      return 0;
    }

    const enableArchiving = this.configService.get<boolean>('retention.enableArchiving', true);

    if (enableArchiving) {
      await this.archiveRecords(records, entityName);
    }

    // Hard delete
    const result = await repository.delete(records.map(r => r.id));
    
    this.logger.log(`Hard deleted ${result.affected} ${entityName} records.`);
    return result.affected || 0;
  }

  /**
   * Purge old audit logs.
   */
  async purgeAuditLogs(): Promise<number> {
    const days = this.configService.get<number>('retention.auditLogRetentionDays', 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    this.logger.log(`Purging audit logs older than ${cutoff.toISOString()}`);

    const repository = this.dataSource.getRepository(AuditLog);
    
    const records = await repository.find({
      where: {
        timestamp: LessThan(cutoff),
      },
      take: this.configService.get<number>('retention.batchSize', 1000),
    });

    if (records.length === 0) {
      return 0;
    }

    const enableArchiving = this.configService.get<boolean>('retention.enableArchiving', true);
    if (enableArchiving) {
      await this.archiveRecords(records, 'AuditLog');
    }

    const result = await repository.delete(records.map(r => r.id));
    return result.affected || 0;
  }

  /**
   * Purge old notifications.
   */
  async purgeNotifications(): Promise<number> {
    const days = this.configService.get<number>('retention.notificationRetentionDays', 30);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    this.logger.log(`Purging notifications older than ${cutoff.toISOString()}`);

    const repository = this.dataSource.getRepository(Notification);
    
    const records = await repository.find({
      where: {
        createdAt: LessThan(cutoff),
      },
      take: this.configService.get<number>('retention.batchSize', 1000),
    });

    if (records.length === 0) {
      return 0;
    }

    const enableArchiving = this.configService.get<boolean>('retention.enableArchiving', true);
    if (enableArchiving) {
      await this.archiveRecords(records, 'Notification');
    }

    const result = await repository.delete(records.map(r => r.id));
    return result.affected || 0;
  }

  /**
   * Helper to archive records into the ArchivedData table.
   */
  private async archiveRecords(records: any[], entityType: string): Promise<void> {
    const archives = records.map(record => ({
      entityType,
      originalId: record.id,
      data: record,
      tableName: this.dataSource.getMetadata(record.constructor).tableName,
    }));

    await this.archiveRepo.save(archives);
    this.logger.debug(`Archived ${records.length} ${entityType} records.`);
  }
}
