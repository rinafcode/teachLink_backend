import { ConfigService } from '@nestjs/config';
import { AnomalyDetectionService } from './anomaly-detection.service';

describe('AnomalyDetectionService', () => {
  const makeConfigService = (overrides: Record<string, unknown> = {}) =>
    ({
      get: jest.fn((key: string, fallback?: unknown) => overrides[key] ?? fallback),
    }) as unknown as ConfigService;

  it('uses configured thresholds for boundary conditions', () => {
    const service = new AnomalyDetectionService(
      makeConfigService({
        ANOMALY_ZSCORE_THRESHOLD: 3,
        ANOMALY_MIN_SAMPLE_COUNT: 2,
        ANOMALY_HYSTERESIS: 0.2,
      }),
    );

    const result = service.detect(2, [0, 0, 0, 1, 1, 1]);
    expect(result.isAnomaly).toBe(false);
    expect(result.score).toBeGreaterThan(0);
  });

  it('returns false for empty history', () => {
    const service = new AnomalyDetectionService(makeConfigService());
    expect(service.detect(10, [])).toEqual({ isAnomaly: false, score: 0 });
  });

  it('requires a minimum sample count before flagging anomalies', () => {
    const service = new AnomalyDetectionService(
      makeConfigService({
        ANOMALY_MIN_SAMPLE_COUNT: 3,
      }),
    );

    expect(service.detect(10, [1, 2])).toEqual({ isAnomaly: false, score: 0 });
  });

  it('treats NaN and undefined values as invalid input', () => {
    const logger = { warn: jest.fn() };
    const service = new AnomalyDetectionService(makeConfigService()) as any;
    service.logger = logger;

    expect(service.detect(Number.NaN, [1, 2, 3])).toEqual({ isAnomaly: false, score: 0 });
    expect(service.detect(undefined, [1, 2, 3])).toEqual({ isAnomaly: false, score: 0 });
    expect(logger.warn).toHaveBeenCalled();
  });
});
