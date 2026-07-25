/* eslint-disable no-console */
import 'dotenv/config';
import axios from 'axios';
import { SlackService } from './slack.service';

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
    // Send the direct message over Axios bypass test
    console.log('Sending direct POST request to Slack...');
    const directResponse = await axios.post(webhookUrl, payload);
    console.log(`Direct Axios post request status: ${directResponse.status}`);

    // Log the exact expected message to console when complete
    console.log('Test message triggered!');

    // Test the imported SlackService logic directly
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
