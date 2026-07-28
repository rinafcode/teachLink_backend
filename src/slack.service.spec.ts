import axios from 'axios';
import { SlackService } from './slack.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SlackService', () => {
  const originalWebhook = process.env.SLACK_WEBHOOK_URL;

  afterEach(() => {
    process.env.SLACK_WEBHOOK_URL = originalWebhook;
    jest.clearAllMocks();
  });

  it('does not post when SLACK_WEBHOOK_URL is unset', async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    const service = new SlackService();

    await service.sendAlert('test message', 'low');

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('posts formatted high-severity alerts to the webhook', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    mockedAxios.post.mockResolvedValue({ status: 200, data: 'ok' });

    const service = new SlackService();
    await service.sendAlert('Integration check', 'high');

    expect(mockedAxios.post).toHaveBeenCalledWith('https://hooks.slack.com/services/test', {
      text: '🚨 *TeachLink Alert* (HIGH)\nIntegration check',
    });
  });
});
