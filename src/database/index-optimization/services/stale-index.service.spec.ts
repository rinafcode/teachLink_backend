import { StaleIndexService } from './stale-index.service';
import { IndexUsageMonitorService } from './index-usage-monitor.service';
import { DataSource } from 'typeorm';

describe('StaleIndexService', () => {
  const makeDataSource = () =>
    ({
      query: jest.fn().mockResolvedValue(undefined),
    }) as unknown as DataSource;

  const makeUsageMonitor = () =>
    ({
      findUnused: jest.fn(),
    }) as unknown as IndexUsageMonitorService;

  const config = {
    enabled: true,
    dryRun: false,
    autoCreate: false,
    autoDropStale: true,
    seqScanThreshold: 1000,
    seqScanRatio: 0.5,
    slowQueryMs: 200,
    staleMinSizeBytes: 1024,
    staleMinScans: 0,
    maxCreatePerRun: 3,
    schema: 'public',
  };

  it('filters only stale non-constraint indexes', async () => {
    const usageMonitor = makeUsageMonitor();
    usageMonitor.findUnused = jest.fn().mockResolvedValue([
      {
        schema: 'public',
        table: 'users',
        indexName: 'idx_users_email',
        scans: 0,
        sizeBytes: 2048,
        isUnique: false,
        isPrimary: false,
        isConstraint: false,
      },
      {
        schema: 'public',
        table: 'users',
        indexName: 'idx_users_pkey',
        scans: 0,
        sizeBytes: 2048,
        isUnique: false,
        isPrimary: true,
        isConstraint: false,
      },
    ]);

    const service = new StaleIndexService(makeDataSource(), usageMonitor, config as any);
    const stale = await service.findStaleIndexes();

    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatchObject({
      indexName: 'idx_users_email',
      table: 'users',
      reason: 'Unused index.',
    });
  });

  it('returns dry-run results without dropping indexes', async () => {
    const usageMonitor = makeUsageMonitor();
    usageMonitor.findUnused = jest.fn().mockResolvedValue([
      {
        schema: 'public',
        table: 'users',
        indexName: 'idx_users_email',
        scans: 0,
        sizeBytes: 2048,
        isUnique: false,
        isPrimary: false,
        isConstraint: false,
      },
    ]);

    const dataSource = makeDataSource();
    const service = new StaleIndexService(dataSource, usageMonitor, config as any);

    await expect(service.removeStaleIndexes(true)).resolves.toEqual([
      {
        indexName: 'idx_users_email',
        table: 'users',
        dropped: false,
        skippedReason: 'dry-run',
      },
    ]);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('drops stale indexes when not in dry-run mode', async () => {
    const usageMonitor = makeUsageMonitor();
    usageMonitor.findUnused = jest.fn().mockResolvedValue([
      {
        schema: 'public',
        table: 'users',
        indexName: 'idx_users_email',
        scans: 0,
        sizeBytes: 2048,
        isUnique: false,
        isPrimary: false,
        isConstraint: false,
      },
    ]);

    const dataSource = makeDataSource();
    const service = new StaleIndexService(dataSource, usageMonitor, config as any);

    await expect(service.removeStaleIndexes(false)).resolves.toEqual([
      {
        indexName: 'idx_users_email',
        table: 'users',
        dropped: true,
      },
    ]);
    expect(dataSource.query).toHaveBeenCalledWith(
      'DROP INDEX CONCURRENTLY IF EXISTS "public"."idx_users_email"',
    );
  });
});
