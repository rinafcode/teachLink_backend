import { Test, TestingModule } from '@nestjs/testing';
import { AlertingService } from './alerting.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AlertingService', () => {
  let service: AlertingService;
  let configService: ConfigService;

  const mockConfig = {
    PAGERDUTY_ROUTING_KEY: 'test-routing-key',
    ALERT_SLACK_WEBHOOK_URL: 'https://example.com/slack-webhook',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key as keyof typeof mockConfig]),
          },
        },
      ],
    }).compile();

    service = module.get<AlertingService>(AlertingService);
    configService = module.get<ConfigService>(ConfigService);
    mockedAxios.post.mockClear();
  });

  it('should send a CRITICAL alert to PagerDuty and Slack', async () => {
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
    );
  });

  it('should NOT send a WARNING alert to PagerDuty', async () => {
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
    );

    // PagerDuty should NOT be called
    const pagerDutyCalls = mockedAxios.post.mock.calls.filter(
      (call) => call[0] === 'https://events.pagerduty.com/v2/enqueue',
    );
    expect(pagerDutyCalls.length).toBe(0);
  });
});
