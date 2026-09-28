import { Test, TestingModule } from '@nestjs/testing';
import { AlertingService } from './alerting.service';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../../utils/masking/metrics.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AlertingService', () => {
  let service: AlertingService;
  let metricsService: { alertDeliveryFailuresCounter: { inc: jest.Mock } };

  const mockConfig: Record<string, unknown> = {
    PAGERDUTY_ROUTING_KEY: 'test-routing-key',
    ALERT_SLACK_WEBHOOK_URL: 'https://example.com/slack-webhook',
  };

  beforeEach(async () => {
    metricsService = { alertDeliveryFailuresCounter: { inc: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) =>
              key in mockConfig ? mockConfig[key] : defaultValue,
            ),
          },
        },
        {
          provide: MetricsService,
          useValue: metricsService,
        },
      ],
    }).compile();

    service = module.get<AlertingService>(AlertingService);
    mockedAxios.post.mockClear();
    (mockedAxios as any).isAxiosError = jest.fn(
      (err: unknown) => !!err && typeof err === 'object' && 'isAxiosError' in (err as object),
    );
  });

  it('should send a CRITICAL alert to PagerDuty and Slack', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200 });

    // Send a critical alert manually
    service.sendAlert('PAYMENT_FAILURE_RATE_CRITICAL', 'Payment failure rate is high', 'CRITICAL');

    // Due to the asynchronous nature of sendPagerDutyAlert, we need a small delay to allow the promises to flush
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify Slack
    expect(mockedAxios.post).toHaveBeenCalledWith(
      mockConfig.ALERT_SLACK_WEBHOOK_URL,
      expect.objectContaining({
        attachments: expect.arrayContaining([expect.objectContaining({ color: '#dc2626' })]),
      }),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );

    // Verify PagerDuty
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://events.pagerduty.com/v2/enqueue',
      expect.objectContaining({
        routing_key: mockConfig.PAGERDUTY_ROUTING_KEY,
        event_action: 'trigger',
        payload: expect.objectContaining({
          severity: 'critical',
          source: 'teachLink_backend',
        }),
      }),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it('should NOT send a WARNING alert to PagerDuty', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200 });

    service.sendAlert(
      'PAYMENT_FAILURE_RATE_WARNING',
      'Payment failure rate is increasing',
      'WARNING',
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Slack should be called
    expect(mockedAxios.post).toHaveBeenCalledWith(
      mockConfig.ALERT_SLACK_WEBHOOK_URL,
      expect.any(Object),
      expect.any(Object),
    );

    // PagerDuty should NOT be called
    const pagerDutyCalls = mockedAxios.post.mock.calls.filter(
      (call) => call[0] === 'https://events.pagerduty.com/v2/enqueue',
    );
    expect(pagerDutyCalls.length).toBe(0);
  });

  it('passes the configured timeout to every outbound delivery call', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200 });

    service.sendAlert('PAYMENT_FAILURE_RATE_CRITICAL', 'high', 'CRITICAL');
    await new Promise((resolve) => setTimeout(resolve, 50));

    for (const call of mockedAxios.post.mock.calls) {
      expect(call[2]).toEqual(expect.objectContaining({ timeout: expect.any(Number) }));
    }
  });

  it('increments the failure counter on a failed Slack delivery and does not throw', async () => {
    mockedAxios.post.mockImplementation((url: string) => {
      if (url === mockConfig.ALERT_SLACK_WEBHOOK_URL) {
        return Promise.reject({
          isAxiosError: true,
          response: { status: 400 },
          message: 'Bad Request',
        });
      }
      return Promise.resolve({ status: 200 });
    });

    expect(() =>
      service.sendAlert('PAYMENT_FAILURE_RATE_CRITICAL', 'high', 'CRITICAL'),
    ).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(metricsService.alertDeliveryFailuresCounter.inc).toHaveBeenCalledWith({
      channel: 'slack',
    });
  });

  it('retries a transient 5xx PagerDuty response and eventually succeeds', async () => {
    let pagerDutyCalls = 0;
    mockedAxios.post.mockImplementation((url: string) => {
      if (url === 'https://events.pagerduty.com/v2/enqueue') {
        pagerDutyCalls += 1;
        if (pagerDutyCalls < 2) {
          return Promise.reject({ isAxiosError: true, response: { status: 503 } });
        }
        return Promise.resolve({ status: 202 });
      }
      return Promise.resolve({ status: 200 });
    });

    service.sendAlert('PAYMENT_FAILURE_RATE_CRITICAL', 'high', 'CRITICAL');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(pagerDutyCalls).toBe(2);
    expect(metricsService.alertDeliveryFailuresCounter.inc).toHaveBeenCalledWith({
      channel: 'pagerduty',
    });
  }, 10000);

  it('gives up after exhausting retries on a persistent 5xx response', async () => {
    mockedAxios.post.mockImplementation((url: string) => {
      if (url === 'https://events.pagerduty.com/v2/enqueue') {
        return Promise.reject({ isAxiosError: true, response: { status: 500 } });
      }
      return Promise.resolve({ status: 200 });
    });

    service.sendAlert('PAYMENT_FAILURE_RATE_CRITICAL', 'high', 'CRITICAL');
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const pagerDutyCalls = mockedAxios.post.mock.calls.filter(
      (call) => call[0] === 'https://events.pagerduty.com/v2/enqueue',
    );
    // Initial attempt + 2 retries = 3 total attempts
    expect(pagerDutyCalls.length).toBe(3);
  }, 10000);
});
