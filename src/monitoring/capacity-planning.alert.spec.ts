import { CapacityPlanningService } from './capacity-planning.service';

describe('CapacityPlanningService alerting integration', () => {
  it('fires alert when forecast predicts exhaustion', async () => {
    const mockMetrics: any = {};
    const mockAlerting: any = { sendAlert: jest.fn() };

    // Worker orchestration will report small pool so utilization becomes high
    const mockWorkerOrchestration: any = {
      getPoolStatistics: () => ({
        totalWorkers: 1,
        totalJobsProcessed: 0,
        averageExecutionTime: 2000,
      }),
      getAllWorkerMetrics: () => [],
    };

    const svc = new CapacityPlanningService(mockMetrics, mockWorkerOrchestration, mockAlerting);

    // Seed samples with rapidly increasing jobsProcessed to create upward trend
    const now = Date.now();
    (svc as any).samples = [
      {
        timestamp: now - 4 * 60_000,
        totalJobsProcessed: 10,
        averageExecutionTimeMs: 2000,
        totalWorkers: 1,
      },
      {
        timestamp: now - 3 * 60_000,
        totalJobsProcessed: 30,
        averageExecutionTimeMs: 2000,
        totalWorkers: 1,
      },
      {
        timestamp: now - 2 * 60_000,
        totalJobsProcessed: 90,
        averageExecutionTimeMs: 2000,
        totalWorkers: 1,
      },
      {
        timestamp: now - 1 * 60_000,
        totalJobsProcessed: 270,
        averageExecutionTimeMs: 2000,
        totalWorkers: 1,
      },
    ];

    // Now invoke analysis which should detect predicted utilization >= 90% and call sendAlert
    await svc.sampleAndAnalyze();

    expect(mockAlerting.sendAlert).toHaveBeenCalled();
  });
});
