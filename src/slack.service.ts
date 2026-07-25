import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SlackService {
  // This automatically reads the secret URL you just pasted into your .env file
  private readonly webhookUrl = process.env.SLACK_WEBHOOK_URL;

  async sendAlert(message: string, severity: 'low' | 'medium' | 'high') {
    if (!this.webhookUrl) {
      // console.error('Slack Webhook URL is missing in .env file!');
      return;
    }

    // Choose an emoji based on how urgent the alert is
    let emoji = 'ℹ️'; // Default for low
    if (severity === 'high') {
      emoji = '🚨';
    } else if (severity === 'medium') {
      emoji = '⚠️';
    }

    // Format the text nicely for your Slack channel
    const payload = {
      text: `${emoji} *TeachLink Alert* (${severity.toUpperCase()})\n${message}`,
    };

    try {
      // Send the message over the internet to Slack
      await axios.post(this.webhookUrl, payload);
      // console.log(`Slack alert (${severity}) sent successfully!`);
    } catch (_error) {
      // console.error('Failed to send Slack alert:', error.message);
    }
  }
}
