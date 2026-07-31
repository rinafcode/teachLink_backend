/* eslint-disable no-console */
import 'dotenv/config';
import axios from 'axios';
import { SlackService } from '../src/slack.service';

async function run() {
  console.log('Initializing Slack Webhook bypass test...');

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error('Error: SLACK_WEBHOOK_URL is not set in the environment variables.');
    return;
  }

  const payload = {
    text: '🚨 *TeachLink Alert* (HIGH)\nDirect Antigravity bypass testing successful! The integration works flawlessly. 🎉',
  };

  try {
    console.log('Sending direct POST request to Slack...');
    const directResponse = await axios.post(webhookUrl, payload);
    console.log(`Direct Axios post request status: ${directResponse.status}`);

    console.log('Test message triggered!');

    console.log('\nTesting imported SlackService integration...');
    const slackService = new SlackService();
    await slackService.sendAlert(
      'Direct Antigravity bypass testing successful! The integration works flawlessly. 🎉',
      'high',
    );
  } catch (error: any) {
    console.error('Bypass test execution failed:', error.response?.data || error.message);
  }
}

run();
