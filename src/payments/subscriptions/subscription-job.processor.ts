import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription, SubscriptionStatus } from '../entities/subscription.entity';

export interface ResumeSubscriptionJobData {
  subscriptionId: string;
  userId?: string;
  reason?: string;
}

@Processor(QUEUE_NAMES.SUBSCRIPTIONS)
export class SubscriptionJobProcessor {
  private readonly logger = new Logger(SubscriptionJobProcessor.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  @Process(JOB_NAMES.PROCESS_SUBSCRIPTION)
  async handleSubscription(job: Job<unknown>): Promise<unknown> {
    // Process subscription job
    this.logger.log('Processing subscription job:', job.data);
    return { success: true };
  }

  @Process(JOB_NAMES.RESUME_SUBSCRIPTION)
  async handleResumeSubscription(job: Job<ResumeSubscriptionJobData>): Promise<unknown> {
    const { subscriptionId } = job.data;
    this.logger.log(`Processing automatic resume for subscription: ${subscriptionId}`);

    if (!subscriptionId) {
      this.logger.warn('Missing subscriptionId in resume job payload');
      return { success: false, reason: 'Missing subscriptionId' };
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      this.logger.warn(`Subscription ${subscriptionId} not found for auto-resume`);
      return { success: false, reason: 'Subscription not found' };
    }

    // Safe handling for cancelled subscriptions
    if (subscription.status === SubscriptionStatus.CANCELLED) {
      this.logger.log(`Subscription ${subscriptionId} is cancelled. Skipping auto-resume.`);
      return { success: false, reason: 'Subscription cancelled' };
    }

    // Idempotency check: Guard against double-resume or already resumed subscriptions
    if (!subscription.properties?.isPaused) {
      this.logger.log(
        `Subscription ${subscriptionId} is not paused (already resumed). Skipping auto-resume.`,
      );
      return { success: true, reason: 'Subscription not paused' };
    }

    try {
      await this.subscriptionsService.resumeSubscription(subscriptionId, {
        reason: job.data.reason || 'Automatic resume from scheduled pause',
      });
      this.logger.log(`Successfully auto-resumed subscription ${subscriptionId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to auto-resume subscription ${subscriptionId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
