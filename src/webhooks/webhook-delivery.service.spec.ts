import { of, throwError } from 'rxjs';
import {
  WebhookDeliveryService,
  WebhookRetryableError,
  WEBHOOK_EVENTS,
  WebhookTarget,
} from './webhook-delivery.service';
import { WebhookMonitorService } from './webhook-monitor.service';
import { DEFAULT_WEBHOOK_RETRY_CONFIG, WebhookRetryConfig } from './webhook-retry.config';

const config: WebhookRetryConfig = {
  ...DEFAULT_WEBHOOK_RETRY_CONFIG,
  maxRetries: 3,
  initialDelayMs: 1_000,
  backoffMultiplier: 2,
  maxDelayMs: 60_000,
  jitter: false,
};

const target: WebhookTarget = {
  url: 'https://example.com/hook',
  event: 'course.completed',
  payload: { courseId: 'c1' },
};

describe('WebhookDeliveryService', () => {
  let http: { post: jest.Mock };
  let events: { emit: jest.Mock };
  let monitor: WebhookMonitorService;
  let service: WebhookDeliveryService;

  beforeEach(() => {
    http = { post: jest.fn() };
    events = { emit: jest.fn() };
    monitor = new WebhookMonitorService();
    service = new WebhookDeliveryService(http as any, monitor, events as any, config);
  });

  it('delivers successfully and records success', async () => {
    http.post.mockReturnValue(of({ status: 200 }));

    const result = await service.processDelivery(target, 0);

    expect(result).toMatchObject({ delivered: true, statusCode: 200, attempts: 1 });
    expect(events.emit).toHaveBeenCalledWith(WEBHOOK_EVENTS.DELIVERED, expect.any(Object));
    expect(monitor.getStats()).toMatchObject({ attempts: 1, succeeded: 1, failed: 0 });
  });

  it('throws a retryable error with backoff delay on a 5xx response', async () => {
    http.post.mockReturnValue(throwError(() => ({ response: { status: 503 } })));

    await expect(service.processDelivery(target, 0)).rejects.toBeInstanceOf(WebhookRetryableError);

    const stats = monitor.getStats();
    expect(stats.failed).toBe(1);
    expect(stats.retried).toBe(1);
    expect(events.emit).toHaveBeenCalledWith(
      WEBHOOK_EVENTS.RETRY_SCHEDULED,
      expect.objectContaining({ attempt: 1, nextDelayMs: 1_000 }),
    );
  });

  it('uses exponential backoff across attempts', async () => {
    http.post.mockReturnValue(throwError(() => ({ response: { status: 500 } })));

    // attemptsMade = 1 → this is attempt #2 → delay 2000ms
    await expect(service.processDelivery(target, 1)).rejects.toMatchObject({ nextDelayMs: 2_000 });
  });

  it('dead-letters a permanent 4xx failure without retrying', async () => {
    http.post.mockReturnValue(throwError(() => ({ response: { status: 404 } })));

    const result = await service.processDelivery(target, 0);

    expect(result).toMatchObject({ delivered: false, deadLettered: true });
    expect(monitor.getStats()).toMatchObject({ deadLettered: 1, retried: 0 });
    expect(events.emit).toHaveBeenCalledWith(
      WEBHOOK_EVENTS.DEAD_LETTER,
      expect.objectContaining({ reason: 'permanent_failure' }),
    );
  });

  it('dead-letters once retries are exhausted', async () => {
    http.post.mockReturnValue(throwError(() => ({ response: { status: 503 } })));

    // attemptsMade = 2 → attempt #3 = maxRetries → no further retry
    const result = await service.processDelivery(target, 2);

    expect(result).toMatchObject({ deadLettered: true });
    expect(events.emit).toHaveBeenCalledWith(
      WEBHOOK_EVENTS.DEAD_LETTER,
      expect.objectContaining({ reason: 'max_retries_exhausted' }),
    );
  });

  it('signs the payload with HMAC when a secret is provided', async () => {
    http.post.mockReturnValue(of({ status: 200 }));

    await service.processDelivery({ ...target, secret: 'shh' }, 0);

    const [, , options] = http.post.mock.calls[0];
    expect(options.headers['X-Webhook-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('rejects targets missing required fields', async () => {
    await expect(
      service.processDelivery({ url: '', event: '', payload: undefined } as WebhookTarget, 0),
    ).rejects.toThrow('Missing required webhook fields');
  });

  it('exposes Bull job options matching the retry policy', () => {
    expect(service.buildJobOptions()).toMatchObject({
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000 },
    });
  });
});
