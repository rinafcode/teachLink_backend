jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

jest.mock('os', () => ({
  cpus: jest.fn(),
  loadavg: jest.fn(),
}));

import { readFileSync } from 'fs';
import * as os from 'os';
import { ContainerCpuMetricsService } from './container-cpu-metrics.service';

describe('ContainerCpuMetricsService', () => {
  const mockedReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
  const mockedCpus = os.cpus as jest.MockedFunction<typeof os.cpus>;
  const mockedLoadavg = os.loadavg as jest.MockedFunction<typeof os.loadavg>;

  const originalFetch = global.fetch;
  const originalPrometheusUrl = process.env.PROMETHEUS_METRICS_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PROMETHEUS_METRICS_URL = undefined;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.PROMETHEUS_METRICS_URL = originalPrometheusUrl;
  });

  it('reads cgroup v2 cpu.stat and returns throttling ratio', async () => {
    mockedCpus.mockReturnValue([{ model: 'cpu', speed: 1000, times: {} as never }] as never);
    mockedReadFileSync.mockReturnValue(
      'usage_usec 100000\nnr_periods 100\nnr_throttled 80\n' as never,
    );

    const service = new ContainerCpuMetricsService();
    const ratio = await service.getCpuLoadRatio();

    expect(ratio).toBeCloseTo(0.8, 4);
  });

  it('falls back to os.loadavg when cgroup is unavailable', async () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error('missing');
    });
    mockedLoadavg.mockReturnValue([2, 1, 1]);
    mockedCpus.mockReturnValue([
      { model: 'cpu-1', speed: 1000, times: {} as never },
      { model: 'cpu-2', speed: 1000, times: {} as never },
      { model: 'cpu-3', speed: 1000, times: {} as never },
      { model: 'cpu-4', speed: 1000, times: {} as never },
    ] as never);

    const service = new ContainerCpuMetricsService();
    const ratio = await service.getCpuLoadRatio();

    expect(ratio).toBeCloseTo(0.5, 4);
  });

  it('falls back to Prometheus process_cpu_seconds_total when cgroup is unavailable', async () => {
    process.env.PROMETHEUS_METRICS_URL = 'http://127.0.0.1:3000/metrics';

    mockedReadFileSync.mockImplementation(() => {
      throw new Error('missing');
    });
    mockedCpus.mockReturnValue([
      { model: 'cpu-1', speed: 1000, times: {} as never },
      { model: 'cpu-2', speed: 1000, times: {} as never },
    ] as never);
    mockedLoadavg.mockReturnValue([0.4, 0, 0]);

    jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '# HELP process_cpu_seconds_total\nprocess_cpu_seconds_total 10\n',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '# HELP process_cpu_seconds_total\nprocess_cpu_seconds_total 11\n',
      } as Response);

    const service = new ContainerCpuMetricsService();

    const firstRatio = await service.getCpuLoadRatio();
    const secondRatio = await service.getCpuLoadRatio();

    expect(firstRatio).toBeCloseTo(0.2, 4);
    expect(secondRatio).toBeCloseTo(0.5, 4);
  });
});
