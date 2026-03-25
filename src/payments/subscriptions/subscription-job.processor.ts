import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

@Processor('subscriptions')
export class SubscriptionJobProcessor {
  private readonly logger = new Logger(SubscriptionJobProcessor.name);
  @Process('process_subscription')
  async handleSubscription(job: Job<any>) {
    // Process subscription job
    this.logger.log('Processing subscription job:', job.data);
    return { success: true };
  }
}
