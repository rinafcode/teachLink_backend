import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { BaseWorker } from '../base/base.worker';

/**
 * Email Worker
 * Handles email sending and notification tasks
 */
@Injectable()
export class EmailWorker extends BaseWorker {
  constructor() {
    super('email');
  }

  /**
   * Execute email job
   */
  async execute(job: Job): Promise<any> {
    const { to, subject, template, variables } = job.data;

    await job.progress(25);

    // Validate email data
    if (!to || !subject) {
      throw new Error('Missing required email fields: to, subject');
    }

    await job.progress(50);

    // Simulate email sending process
    try {
      // This is where actual email service integration would happen
      // For example: SendGrid, Nodemailer, AWS SES, etc.
      this.logger.log(`Preparing email to ${to} with subject "${subject}"`);

      await new Promise((resolve) => setTimeout(resolve, 100));

      await job.progress(75);

      // Log email metadata
      const result = {
        to,
        subject,
        template: template || 'default',
        variables: variables || {},
        sentAt: new Date(),
        status: 'sent',
      };

      await job.progress(100);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }
}
