import { CdnService } from './cdn.service';
import { externalCallRetryCounter } from '../common/utils/retry-policy';

describe('CdnService invalidate retry behaviour', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CDN_ENABLED = 'true';
    process.env.CLOUDFRONT_DISTRIBUTION_ID = 'dist-123';
    externalCallRetryCounter.reset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it(
    'retries transparently on a single transient failure and still succeeds',
    async () => {
      const service = new CdnService();
      const transientError = { status: 503 };
      jest
        .spyOn(service as any, 'callInvalidationProvider')
        .mockRejectedValueOnce(transientError)
        .mockResolvedValue(undefined);

      const result = await service.invalidate(['/index.html']);

      expect(result.success).toBe(true);
      expect((service as any).callInvalidationProvider).toHaveBeenCalledTimes(2);
    },
    10000,
  );

  it(
    'propagates the error to the caller after 3 consecutive failures',
    async () => {
      const service = new CdnService();
      const transientError = { status: 503 };
      jest.spyOn(service as any, 'callInvalidationProvider').mockRejectedValue(transientError);

      await expect(service.invalidate(['/index.html'])).rejects.toEqual(transientError);
      expect((service as any).callInvalidationProvider).toHaveBeenCalledTimes(4); // initial + 3 retries
    },
    15000,
  );
});
