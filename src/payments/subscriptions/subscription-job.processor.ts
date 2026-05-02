import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';
@Processor(QUEUE_NAMES.SUBSCRIPTIONS)
export class SubscriptionJobProcessor {
    private readonly logger = new Logger(SubscriptionJobProcessor.name);
    @Process(JOB_NAMES.PROCESS_SUBSCRIPTION)
    async handleSubscription(job: Job<unknown>): Promise<unknown> {
        // Process subscription job
        this.logger.log('Processing subscription job:', job.data);
        return { success: true };
    }
}
