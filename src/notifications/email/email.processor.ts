import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EmailService, EmailOptions } from './email.service';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  @Process(JOB_NAMES.SEND_EMAIL)
  async handleSendEmail(job: Job<EmailOptions>) {
    this.logger.log(`Processing email job ${job.id} for ${job.data.to}`);

    try {
      await this.emailService.sendEmail(job.data);
      this.logger.log(`Email job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Email job ${job.id} failed: ${error.message}`, error.stack);

      // Check if job should be retried using built-in Bull retry settings
      const maxAttempts = job.opts.attempts || 3;

      if (job.attemptsMade >= maxAttempts) {
        // Send to dead letter queue
        this.logger.error(
          `Job ${job.id} moved to dead letter queue after ${job.attemptsMade} attempts. Final error: ${error.message}`,
        );
        // In production, you would push to a dead letter queue here:
        // await this.deadLetterQueue.add('failed-email', { ...job.data, error: error.message });
      } else {
        // Re-throw to let Bull handle the retry with exponential backoff
        throw error;
      }
    }
  }
}
