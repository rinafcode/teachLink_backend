import { CapacityPlanningService } from '../../src/monitoring/capacity-planning.service';

const noop: any = () => {};
const mockMetrics: any = {};
const mockWorkerOrchestration: any = {
  getPoolStatistics: () => ({ totalWorkers: 4, totalJobsProcessed: 120, averageExecutionTime: 200 }),
};
const mockAlerting: any = { sendAlert: noop };

describe('CapacityPlanningService', () => {
  let svc: CapacityPlanningService;

  beforeEach(() => {
    svc = new CapacityPlanningService(mockMetrics, mockWorkerOrchestration, mockAlerting);
  });

  it('computes linear regression correctly for increasing points', () => {
    const points = [
      { x: 0, y: 10 },
      { x: 1, y: 20 },
      { x: 2, y: 30 },
      { x: 3, y: 40 },
    ];
    const { slope, intercept } = (svc as any).linearRegression(points);
    expect(Math.round(slope)).toBe(10);
    expect(Math.round(intercept)).toBe(10);
  });

  it('recommends more workers when predicted util is high', () => {
    const recommended = svc.recommendWorkers(1.0, 4); // 100% -> target 60%
    expect(recommended).toBeGreaterThan(4);
    const same = svc.recommendWorkers(0.4, 4); // 40% -> below target
    expect(same).toBe(4);
  });

  it('forecasts flat when not enough samples', () => {
    (svc as any).samples = [];
    const out = svc.forecastUtilizationMinutes(5);
    expect(out.length).toBe(5);
    expect(out.every((p) => p.utilization === 0)).toBe(true);
  });
});
