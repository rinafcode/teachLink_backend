import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DataRetentionService } from './data-retention.service';
import { ArchivedData } from './entities/archived-data.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { Notification } from '../notifications/entities/notification.entity';

describe('DataRetentionService', () => {
  const archiveRepo = {
    save: jest.fn().mockResolvedValue(undefined),
  };

  const makeRepo = () => ({
    find: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  });

  const makeConfig = (overrides: Record<string, any> = {}) =>
    ({
      get: jest.fn((key: string, defaultValue: any) => {
        const defaults: Record<string, any> = {
          'retention.softDeleteRetentionDays': 30,
          'retention.auditLogRetentionDays': 90,
          'retention.notificationRetentionDays': 30,
          'retention.batchSize': 1000,
          'retention.enableArchiving': true,
        };
        return key in overrides ? overrides[key] : (defaults[key] ?? defaultValue);
      }),
    }) as unknown as ConfigService;

  const makeDataSource = (softRepo: any, auditRepo: any, notificationRepo: any) =>
    ({
      getRepository: jest.fn((entity: any) => {
        if (entity === ArchivedSource) return softRepo;
        if (entity === AuditLog) return auditRepo;
        if (entity === Notification) return notificationRepo;
        return null;
      }),
      getMetadata: jest.fn(() => ({ tableName: 'archived_source' })),
    }) as unknown as DataSource;

  class ArchivedSource {
    id = 'arch-1';
    deletedAt = new Date('2026-01-01T00:00:00Z');
  }

  it('archives and deletes old soft-deleted records', async () => {
    const softRepo = makeRepo();
    softRepo.find.mockResolvedValue([Object.assign(new ArchivedSource(), { id: 'arch-1' })]);
    const auditRepo = makeRepo();
    const notificationRepo = makeRepo();
    const dataSource = makeDataSource(softRepo, auditRepo, notificationRepo);
    const service = new DataRetentionService(dataSource, makeConfig(), archiveRepo as any);

    const removed = await service.purgeSoftDeleted(ArchivedSource, 'ArchivedSource');

    expect(removed).toBe(1);
    expect(archiveRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ entityType: 'ArchivedSource', originalId: 'arch-1' }),
      ]),
    );
    expect(softRepo.delete).toHaveBeenCalledWith(['arch-1']);
  });

  it('returns zero when no audit logs are eligible', async () => {
    const softRepo = makeRepo();
    const auditRepo = makeRepo();
    auditRepo.find.mockResolvedValue([]);
    const notificationRepo = makeRepo();
    const service = new DataRetentionService(
      makeDataSource(softRepo, auditRepo, notificationRepo),
      makeConfig({ 'retention.enableArchiving': false }),
      archiveRepo as any,
    );

    await expect(service.purgeAuditLogs()).resolves.toBe(0);
  });

  it('purges notifications without archiving when archiving is disabled', async () => {
    const softRepo = makeRepo();
    const auditRepo = makeRepo();
    const notificationRepo = makeRepo();
    notificationRepo.find.mockResolvedValue([{ id: 'notif-1' }]);
    const service = new DataRetentionService(
      makeDataSource(softRepo, auditRepo, notificationRepo),
      makeConfig({ 'retention.enableArchiving': false }),
      archiveRepo as any,
    );

    await expect(service.purgeNotifications()).resolves.toBe(1);
    expect(notificationRepo.delete).toHaveBeenCalledWith(['notif-1']);
  });
});
