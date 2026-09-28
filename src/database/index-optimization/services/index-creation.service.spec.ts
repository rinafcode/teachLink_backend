import { IndexCreationService } from './index-creation.service';
import { DataSource } from 'typeorm';
import { IIndexRecommendation } from '../interfaces/index-optimization.interfaces';

describe('IndexCreationService', () => {
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
    maxCreatePerRun: 1,
    schema: 'public',
  };

  const recommendation: IIndexRecommendation = {
    table: 'enrollments',
    columns: ['courseId'],
    reason: 'high_seq_scan' as any,
    suggestedName: 'idx_enrollments_courseId',
    ddl: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_enrollments_courseId" ON "public"."enrollments" ("courseId")',
    score: 90,
    rationale: 'needed',
  };

  const makeDataSource = (responses: any[]) =>
    ({
      query: jest.fn().mockImplementation(async () => responses.shift()),
    }) as unknown as DataSource;

  it('skips work in dry-run mode', async () => {
    const service = new IndexCreationService(makeDataSource([]), config as any);
    await expect(service.createFromRecommendations([recommendation], true)).resolves.toEqual([
      {
        suggestedName: recommendation.suggestedName,
        table: recommendation.table,
        ddl: recommendation.ddl,
        created: false,
        skippedReason: 'dry-run',
      },
    ]);
  });

  it('creates a valid index', async () => {
    const dataSource = makeDataSource([[{}], [{ valid: true }]]);
    const service = new IndexCreationService(dataSource, { ...config, dryRun: false } as any);

    await expect(service.createOne(recommendation)).resolves.toEqual({
      suggestedName: recommendation.suggestedName,
      table: recommendation.table,
      ddl: recommendation.ddl,
      created: true,
    });
  });

  it('drops invalid indexes after creation', async () => {
    const dataSource = makeDataSource([[{}], [{ valid: false }], [{}]]);
    const service = new IndexCreationService(dataSource, { ...config, dryRun: false } as any);

    await expect(service.createOne(recommendation)).resolves.toMatchObject({
      created: false,
      error: 'index build was invalid and has been dropped',
    });
  });
});
