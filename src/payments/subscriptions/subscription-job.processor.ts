import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('subscriptions')
export class SubscriptionJobProcessor {
  @Process('process_subscription')
  async handleSubscription(job: Job<any>) {
    // Process subscription job
    console.log('Processing subscription job:', job.data);
    return { success: true };
  }
}