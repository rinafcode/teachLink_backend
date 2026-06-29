import {
  FraudDetectionService,
  IpRateSignalProvider,
  NewDeviceSignalProvider,
  LargeTransactionSignalProvider,
  VelocitySignalProvider,
  GeoAnomalySignalProvider,
  FraudContext,
} from './fraud-detection.service';

function makeConfigService(overrides: Record<string, number> = {}) {
  return {
    get: jest.fn((key: string, defaultValue: number) => overrides[key] ?? defaultValue),
  } as any;
}

const baseCtx = (): FraudContext => ({
  ipRequestCount: 0,
  isNewDevice: false,
  amountUsd: 0,
});

describe('IpRateSignalProvider', () => {
  const provider = new IpRateSignalProvider(100);

  it('emits high-severity signal above threshold', () => {
    const signals = provider.evaluate({ ...baseCtx(), ipRequestCount: 101 });
    expect(signals).toEqual([{ type: 'high_request_rate', severity: 'high' }]);
  });

  it('emits no signal at or below threshold', () => {
    expect(provider.evaluate({ ...baseCtx(), ipRequestCount: 100 })).toHaveLength(0);
    expect(provider.evaluate({ ...baseCtx(), ipRequestCount: 50 })).toHaveLength(0);
  });
});

describe('NewDeviceSignalProvider', () => {
  const provider = new NewDeviceSignalProvider(500);

  it('emits medium-severity signal for new device with large amount', () => {
    const signals = provider.evaluate({ ...baseCtx(), isNewDevice: true, amountUsd: 501 });
    expect(signals).toEqual([{ type: 'new_device_large_amount', severity: 'medium' }]);
  });

  it('emits no signal for known device regardless of amount', () => {
    expect(provider.evaluate({ ...baseCtx(), isNewDevice: false, amountUsd: 1000 })).toHaveLength(
      0,
    );
  });

  it('emits no signal for new device with small amount', () => {
    expect(provider.evaluate({ ...baseCtx(), isNewDevice: true, amountUsd: 499 })).toHaveLength(0);
  });
});

describe('LargeTransactionSignalProvider', () => {
  const provider = new LargeTransactionSignalProvider(10_000);

  it('emits high-severity signal above threshold', () => {
    const signals = provider.evaluate({ ...baseCtx(), amountUsd: 10_001 });
    expect(signals).toEqual([{ type: 'large_transaction', severity: 'high' }]);
  });

  it('emits no signal at or below threshold', () => {
    expect(provider.evaluate({ ...baseCtx(), amountUsd: 10_000 })).toHaveLength(0);
  });
});

describe('VelocitySignalProvider', () => {
  const provider = new VelocitySignalProvider(10);

  it('emits high-severity signal when velocity exceeds threshold', () => {
    const signals = provider.evaluate({ ...baseCtx(), purchasesPerHour: 11 });
    expect(signals).toEqual([{ type: 'velocity_exceeded', severity: 'high' }]);
  });

  it('emits no signal when velocity is within threshold', () => {
    expect(provider.evaluate({ ...baseCtx(), purchasesPerHour: 10 })).toHaveLength(0);
    expect(provider.evaluate({ ...baseCtx(), purchasesPerHour: 5 })).toHaveLength(0);
  });

  it('emits no signal when purchasesPerHour is not provided', () => {
    expect(provider.evaluate(baseCtx())).toHaveLength(0);
  });
});

describe('GeoAnomalySignalProvider', () => {
  const provider = new GeoAnomalySignalProvider();

  it('emits medium-severity signal when countries differ', () => {
    const signals = provider.evaluate({
      ...baseCtx(),
      requestCountry: 'NG',
      registrationCountry: 'US',
    });
    expect(signals).toEqual([{ type: 'geo_anomaly', severity: 'medium' }]);
  });

  it('emits no signal when countries match', () => {
    expect(
      provider.evaluate({ ...baseCtx(), requestCountry: 'US', registrationCountry: 'US' }),
    ).toHaveLength(0);
  });

  it('emits no signal when country info is missing', () => {
    expect(provider.evaluate(baseCtx())).toHaveLength(0);
    expect(provider.evaluate({ ...baseCtx(), requestCountry: 'US' })).toHaveLength(0);
    expect(provider.evaluate({ ...baseCtx(), registrationCountry: 'US' })).toHaveLength(0);
  });
});

describe('FraudDetectionService', () => {
  it('uses configurable thresholds from ConfigService', () => {
    const config = makeConfigService({
      FRAUD_IP_RATE_THRESHOLD: 50,
      FRAUD_LARGE_TX_THRESHOLD: 5_000,
    });
    const service = new FraudDetectionService(config);

    // Custom IP threshold of 50
    const result = service.assess({ ...baseCtx(), ipRequestCount: 51 });
    expect(result.isSuspicious).toBe(true);
    expect(result.signals.some((s) => s.type === 'high_request_rate')).toBe(true);
  });

  it('aggregates signals from all providers', () => {
    const service = new FraudDetectionService(makeConfigService());
    const result = service.assess({
      ipRequestCount: 101,
      isNewDevice: true,
      amountUsd: 600,
      purchasesPerHour: 15,
      requestCountry: 'CN',
      registrationCountry: 'US',
    });

    expect(result.isSuspicious).toBe(true);
    expect(result.signals.map((s) => s.type)).toEqual(
      expect.arrayContaining([
        'high_request_rate',
        'new_device_large_amount',
        'velocity_exceeded',
        'geo_anomaly',
      ]),
    );
  });

  it('returns isSuspicious=false when no high-severity signals', () => {
    const service = new FraudDetectionService(makeConfigService());
    const result = service.assess({
      ipRequestCount: 50,
      isNewDevice: true,
      amountUsd: 600,
      requestCountry: 'NG',
      registrationCountry: 'US',
    });
    // Only medium signals (new_device_large_amount + geo_anomaly)
    expect(result.isSuspicious).toBe(false);
    expect(result.signals.every((s) => s.severity !== 'high')).toBe(true);
  });
});
