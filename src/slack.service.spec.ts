import axios from 'axios';
import { SlackService } from './slack.service';
import { MetricsService } from './utils/masking/metrics.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SlackService', () => {
  const originalWebhook = process.env.SLACK_WEBHOOK_URL;
  const originalTimeout = process.env.ALERT_DELIVERY_TIMEOUT_MS;
  let metricsService: { alertDeliveryFailuresCounter: { inc: jest.Mock } };

  beforeEach(() => {
    metricsService = { alertDeliveryFailuresCounter: { inc: jest.fn() } };
    (mockedAxios as any).isAxiosError = jest.fn(
      (err: unknown) => !!err && typeof err === 'object' && 'isAxiosError' in (err as object),
    );
  });

  afterEach(() => {
    process.env.SLACK_WEBHOOK_URL = originalWebhook;
    process.env.ALERT_DELIVERY_TIMEOUT_MS = originalTimeout;
    jest.clearAllMocks();
  });

  it('does not post when SLACK_WEBHOOK_URL is unset', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    const service = new SlackService(metricsService as unknown as MetricsService);

    await service.sendAlert('test message', 'low');

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('posts formatted high-severity alerts to the webhook with a timeout', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    mockedAxios.post.mockResolvedValue({ status: 200, data: 'ok' });

    const service = new SlackService(metricsService as unknown as MetricsService);
    await service.sendAlert('Integration check', 'high');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/test',
      { text: '🚨 *TeachLink Alert* (HIGH)\nIntegration check' },
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it('respects ALERT_DELIVERY_TIMEOUT_MS', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    process.env.ALERT_DELIVERY_TIMEOUT_MS = '1234';
    mockedAxios.post.mockResolvedValue({ status: 200 });

    const service = new SlackService(metricsService as unknown as MetricsService);
    await service.sendAlert('test', 'low');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ timeout: 1234 }),
    );
  });

  it('fails within the configured timeout on a non-responsive endpoint', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    mockedAxios.post.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject({ isAxiosError: true, code: 'ECONNABORTED' }), 20);
        }),
    );

    const service = new SlackService(metricsService as unknown as MetricsService);
    await service.sendAlert('test', 'low');

    expect(metricsService.alertDeliveryFailuresCounter.inc).toHaveBeenCalledWith({
      channel: 'slack',
    });
  });

  it('logs and increments the failure counter instead of swallowing the error silently', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403 },
      message: 'Forbidden',
    });

    const service = new SlackService(metricsService as unknown as MetricsService);
    const errorSpy = jest.spyOn((service as any).logger, 'error');

    await service.sendAlert('test', 'low');

    expect(metricsService.alertDeliveryFailuresCounter.inc).toHaveBeenCalledWith({
      channel: 'slack',
    });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('403'));
  });

  it('retries a transient 5xx response and eventually succeeds', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    let calls = 0;
    mockedAxios.post.mockImplementation(() => {
      calls += 1;
      if (calls < 2) {
        return Promise.reject({ isAxiosError: true, response: { status: 503 } });
      }
      return Promise.resolve({ status: 200 });
    });

    const service = new SlackService(metricsService as unknown as MetricsService);
    await service.sendAlert('test', 'low');

    expect(calls).toBe(2);
  }, 10000);

  it('does not retry a non-5xx (client) error', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    mockedAxios.post.mockRejectedValue({ isAxiosError: true, response: { status: 404 } });

    const service = new SlackService(metricsService as unknown as MetricsService);
    await service.sendAlert('test', 'low');

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });
});
