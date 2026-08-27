import { QueryAnalysisService } from './query-analysis.service';
import { DataSource } from 'typeorm';
import { RecommendationReason } from '../interfaces/index-optimization.interfaces';

describe('QueryAnalysisService', () => {
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

  const makeDataSource = (impl: (sql: string, params?: unknown[]) => Promise<any[]>) =>
    ({
      query: jest.fn(impl),
    }) as unknown as DataSource;

  it('recommends an index for a hot foreign-key table', async () => {
    const dataSource = makeDataSource(async (sql) => {
      if (sql.includes('pg_stat_user_tables')) {
        return [{ table: 'enrollments', seq_scan: 5000, idx_scan: 5, n_live_tup: 2000 }];
      }
      if (sql.includes('pg_index ix')) {
        return [];
      }
      if (sql.includes("con.contype = 'f'")) {
        return [{ table: 'enrollments', columns: ['courseId'] }];
      }
      return [];
    });

    const service = new QueryAnalysisService(dataSource, config as any);
    const recommendations = await service.analyze();

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      table: 'enrollments',
      columns: ['courseId'],
      reason: RecommendationReason.HIGH_SEQ_SCAN,
      suggestedName: 'idx_enrollments_courseId',
    });
  });

  it('returns slow statements when pg_stat_statements is enabled', async () => {
    const dataSource = makeDataSource(async (sql) => {
      if (sql.includes('pg_extension')) {
        return [{ exists: true }];
      }
      if (sql.includes('pg_stat_statements')) {
        return [{ query: 'select * from enrollments', calls: 4, mean_exec_ms: 250 }];
      }
      return [];
    });

    const service = new QueryAnalysisService(dataSource, config as any);

    await expect(service.getSlowStatements(10)).resolves.toEqual([
      { query: 'select * from enrollments', calls: 4, mean_exec_ms: 250 },
    ]);
  });

  it('formats deterministic index names and DDL', () => {
    const service = new QueryAnalysisService(
      { query: jest.fn() } as unknown as DataSource,
      config as any,
    );

    expect(service.indexName('enrollments', ['courseId'])).toBe('idx_enrollments_courseId');
    expect(service.createIndexDdl('enrollments', ['courseId'])).toBe(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_enrollments_courseId" ON "public"."enrollments" ("courseId")',
    );
  });
});
