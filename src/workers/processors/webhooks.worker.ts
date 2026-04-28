import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { BaseWorker } from '../base/base.worker';

/**
 * Webhooks Worker
 * Handles webhook delivery and retry logic
 */
@Injectable()
export class WebhooksWorker extends BaseWorker {
  constructor() {
    super('webhooks');
  }

  /**
   * Execute webhook delivery job
   */
  async execute(job: Job): Promise<any> {
    const { url, event, payload, headers, timeout } = job.data;

    await job.progress(20);

    // Validate webhook data
    if (!url || !event || !payload) {
      throw new Error('Missing required webhook fields: url, event, payload');
    }

    await job.progress(40);

    try {
      this.logger.log(`Delivering webhook: ${event} to ${url}`);

      const result = await this.deliverWebhook(job, url, event, payload, headers, timeout);

      await job.progress(100);
      return result;
    } catch (error) {
      this.logger.error(`Failed to deliver webhook to ${url}:`, error);
      throw error;
    }
  }

  /**
   * Deliver webhook with retry logic
   */
  private async deliverWebhook(
    job: Job,
    url: string,
    event: string,
    payload: any,
    headers?: any,
    timeout?: number,
  ): Promise<any> {
    await job.progress(60);

    const requestBody = {
      id: `evt_${Date.now()}`,
      event,
      timestamp: new Date(),
      payload,
      retryCount: job.attemptsMade,
    };

    // Simulate webhook delivery (in production, this would use axios or fetch)
    try {
      this.logger.log(`Sending webhook payload to ${url}:`, requestBody);

      // Simulate HTTP request
      await new Promise((resolve) => setTimeout(resolve, 100));

      await job.progress(90);

      // Simulate response
      const statusCode = 200; // In production, actual HTTP status

      if (statusCode >= 200 && statusCode < 300) {
        return {
          event,
          url,
          statusCode,
          delivered: true,
          deliveredAt: new Date(),
          retryCount: job.attemptsMade,
        };
      } else {
        throw new Error(`Webhook delivery failed with status ${statusCode}`);
      }
    } catch (error) {
      this.logger.error(`Webhook delivery error for ${url}:`, error.message);
      throw error;
    }
  }
}
