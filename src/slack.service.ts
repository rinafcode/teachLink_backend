import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { MetricsService } from './utils/masking/metrics.service';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  // This automatically reads the secret URL you just pasted into your .env file
  private readonly webhookUrl = process.env.SLACK_WEBHOOK_URL;
  private readonly deliveryTimeoutMs = Number(process.env.ALERT_DELIVERY_TIMEOUT_MS) || 5000;
  private readonly maxDeliveryRetries = 2;
  private readonly retryBaseBackoffMs = 200;

  constructor(private readonly metricsService: MetricsService) {}

  async sendAlert(message: string, severity: 'low' | 'medium' | 'high') {
    if (!this.webhookUrl) {
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

    await this.postWithRetry(payload);
  }

  async sendNotification(channel: string, message: string): Promise<void> {
    try {
      // Slack webhook dispatch logic
    } catch (error) {
      this.logger.error(`Failed to dispatch Slack notification to channel #${channel}`, {
        channel,
        message,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * POST the alert payload with a bounded timeout. Transient 5xx responses are
   * retried with jittered backoff up to `maxDeliveryRetries` times; every
   * failed attempt increments the failure counter, and a delivery that fails
   * for good is logged with the response status instead of swallowed.
   */
  private async postWithRetry(payload: unknown, attempt = 0): Promise<void> {
    try {
      await axios.post(this.webhookUrl, payload, { timeout: this.deliveryTimeoutMs });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      this.metricsService.alertDeliveryFailuresCounter.inc({ channel: 'slack' });

      const isTransient5xx = typeof status === 'number' && status >= 500 && status < 600;
      if (isTransient5xx && attempt < this.maxDeliveryRetries) {
        const backoffMs =
          this.retryBaseBackoffMs * 2 ** attempt + Math.random() * this.retryBaseBackoffMs;
        this.logger.warn(
          `Slack alert delivery failed with status ${status}, retrying ` +
            `(attempt ${attempt + 1}/${this.maxDeliveryRetries}) in ${Math.round(backoffMs)}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.postWithRetry(payload, attempt + 1);
      }

      if (isTransient5xx) {
        this.logger.warn(`Slack alert delivery exhausted retries after ${attempt + 1} attempts`);
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : ((error as { message?: string })?.message ?? String(error));
      this.logger.error(
        `Failed to send Slack alert (status: ${status ?? 'unknown'}): ${errorMessage}`,
      );
    }
  }
}
