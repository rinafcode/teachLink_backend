import { IndexOptimizationService } from './index-optimization.service';
import { QueryAnalysisService } from './services/query-analysis.service';
import { IndexCreationService } from './services/index-creation.service';
import { IndexUsageMonitorService } from './services/index-usage-monitor.service';
import { StaleIndexService } from './services/stale-index.service';

describe('IndexOptimizationService', () => {
  const config = {
    enabled: true,
    dryRun: true,
    autoCreate: true,
    autoDropStale: true,
    seqScanThreshold: 1000,
    seqScanRatio: 0.5,
    slowQueryMs: 200,
    staleMinSizeBytes: 1024,
    staleMinScans: 0,
    maxCreatePerRun: 3,
    schema: 'public',
  };

  const analysis = {
    analyze: jest.fn().mockResolvedValue([{ suggestedName: 'idx_demo', ddl: 'CREATE INDEX', table: 'demo' }]),
  } as unknown as QueryAnalysisService;
  const creation = {
    createFromRecommendations: jest.fn().mockResolvedValue([{ created: true }]),
  } as unknown as IndexCreationService;
  const usageMonitor = {
    sample: jest.fn().mockResolvedValue([]),
  } as unknown as IndexUsageMonitorService;
  const staleIndex = {
    removeStaleIndexes: jest.fn().mockResolvedValue([{ dropped: false }]),
  } as unknown as StaleIndexService;

  it('runs a full cycle and records the summary', async () => {
    const service = new IndexOptimizationService(
      analysis,
      creation,
      usageMonitor,
      staleIndex,
      config as any,
    );

    const summary = await service.run();

    expect(summary.recommendations).toHaveLength(1);
    expect(summary.created).toEqual([{ created: true }]);
    expect(summary.removedStale).toEqual([{ dropped: false }]);
    expect(service.getLastRun()).toEqual(summary);
  });

  it('skips the scheduled run when disabled', async () => {
    const run = jest.spyOn(IndexOptimizationService.prototype, 'run').mockResolvedValue({} as any);
    const service = new IndexOptimizationService(
      analysis,
      creation,
      usageMonitor,
      staleIndex,
      { ...config, enabled: false } as any,
    );

    await service.scheduledRun();

    expect(run).not.toHaveBeenCalled();
    run.mockRestore();
  });

  it('invokes the scheduled run when enabled', async () => {
    const run = jest.spyOn(IndexOptimizationService.prototype, 'run').mockResolvedValue({} as any);
    const service = new IndexOptimizationService(
      analysis,
      creation,
      usageMonitor,
      staleIndex,
      { ...config, enabled: true } as any,
    );

    await service.scheduledRun();

    expect(run).toHaveBeenCalled();
    run.mockRestore();
  });
});
