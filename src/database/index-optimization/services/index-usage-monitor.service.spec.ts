import { IndexUsageMonitorService } from './index-usage-monitor.service';
import { DataSource } from 'typeorm';

describe('IndexUsageMonitorService', () => {
  const config = {
    enabled: true,
    dryRun: true,
    autoCreate: false,
    autoDropStale: false,
    seqScanThreshold: 1000,
    seqScanRatio: 0.5,
    slowQueryMs: 200,
    staleMinSizeBytes: 1024,
    staleMinScans: 0,
    maxCreatePerRun: 3,
    schema: 'public',
  };

  const makeDataSource = (rows: any[]) =>
    ({
      query: jest.fn().mockResolvedValue(rows),
    }) as unknown as DataSource;

  it('samples and normalizes usage stats', async () => {
    const service = new IndexUsageMonitorService(
      makeDataSource([
        {
          schema: 'public',
          table: 'enrollments',
          indexName: 'idx_enrollments_courseId',
          scans: '0',
          sizeBytes: '2048',
          isUnique: 0,
          isPrimary: 0,
          isConstraint: 0,
        },
      ]),
      config as any,
    );

    await expect(service.sample()).resolves.toEqual([
      {
        schema: 'public',
        table: 'enrollments',
        indexName: 'idx_enrollments_courseId',
        scans: 0,
        sizeBytes: 2048,
        isUnique: false,
        isPrimary: false,
        isConstraint: false,
      },
    ]);
  });

  it('returns a cached snapshot after sampling', async () => {
    const service = new IndexUsageMonitorService(
      makeDataSource([]),
      config as any,
    );

    const snapshot = await service.getSnapshot();

    expect(snapshot.indexes).toEqual([]);
    expect(snapshot.sampledAt).toBeDefined();
  });

  it('finds unused indexes at or below the stale scan threshold', async () => {
    const service = new IndexUsageMonitorService(
      makeDataSource([
        {
          schema: 'public',
          table: 'enrollments',
          indexName: 'idx_enrollments_courseId',
          scans: 0,
          sizeBytes: 2048,
          isUnique: false,
          isPrimary: false,
          isConstraint: false,
        },
        {
          schema: 'public',
          table: 'users',
          indexName: 'idx_users_email',
          scans: 5,
          sizeBytes: 2048,
          isUnique: false,
          isPrimary: false,
          isConstraint: false,
        },
      ]),
      { ...config, staleMinScans: 0 } as any,
    );

    await expect(service.findUnused()).resolves.toHaveLength(1);
  });
});
