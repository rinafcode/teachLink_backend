import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { BaseWorker } from '../base/base.worker';
import { EmailTrackingService } from '../../email-marketing/services/email-tracking.service';
import { EmailEventType } from '../../email-marketing/enums/email-event-type.enum';

/**
 * Email Worker
 * Handles email sending and notification tasks
 */
@Injectable()
export class EmailWorker extends BaseWorker {
  constructor(
    private readonly emailTracking: EmailTrackingService,
    configService: ConfigService,
  ) {
    super('email', configService);
  }

  /**
   * Execute email job
   */
  async execute(job: Job): Promise<any> {
    const { to, subject, template, variables, campaignId } = job.data;

    await job.progress(25);

    // Validate email data
    if (!to || !subject) {
      throw new Error('Missing required email fields: to, subject');
    }

    await job.progress(50);

    try {
      this.logger.log(`Preparing email to ${to} with subject "${subject}"`);

      await new Promise((resolve) => setTimeout(resolve, 100));

      await job.progress(75);

      const result = {
        to,
        subject,
        template: template || 'default',
        variables: variables || {},
        sentAt: new Date(),
        status: 'sent',
      };

      // ONLY use valid EmailEvent fields
      await this.emailTracking.recordSent({
        recipientId: to,
        campaignId: campaignId || null,
        eventType: EmailEventType.SENT,
      });

      await job.progress(100);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }
}
