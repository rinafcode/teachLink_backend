import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription, SubscriptionStatus } from '../entities/subscription.entity';
import { IPaymentProvider } from '../providers/payment-provider.interface';

export interface ResumeSubscriptionJobData {
  subscriptionId: string;
  userId?: string;
  reason?: string;
}

@Injectable()
@Processor(QUEUE_NAMES.SUBSCRIPTIONS)
export class SubscriptionJobProcessor {
  private readonly logger = new Logger(SubscriptionJobProcessor.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @Optional()
    @Inject('IPaymentProvider')
    private readonly paymentProvider?: IPaymentProvider,
  ) {}

  @Process(JOB_NAMES.PROCESS_SUBSCRIPTION)
  async handleSubscription(job: Job<unknown>): Promise<unknown> {
    this.logger.log('Processing subscription job:', job.data);
    return { success: true };
  }

  @Process(JOB_NAMES.RESUME_SUBSCRIPTION)
  async handleResumeSubscription(
    job: Job<ResumeSubscriptionJobData>,
  ): Promise<{ success: boolean; reason?: string; message?: string }> {
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
    if (!subscription.properties?.isPaused && subscription.status !== SubscriptionStatus.PAUSED) {
      this.logger.log(
        `Subscription ${subscriptionId} is not paused (already resumed). Skipping auto-resume.`,
      );
      return { success: true, reason: 'Subscription not paused' };
    }

    // Resume at provider (Stripe) if provider subscription ID is present
    if (subscription.providerSubscriptionId && this.paymentProvider?.resumeSubscription) {
      try {
        await this.paymentProvider.resumeSubscription(subscription.providerSubscriptionId);
      } catch (error) {
        this.logger.error(
          `Failed to resume subscription ${subscriptionId} at payment provider: ${(error as Error).message}`,
        );
        throw error;
      }
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

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.debug(`Completed job ${job.id} of type ${job.name}. Result:`, result);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Failed job ${job.id} of type ${job.name}. Error:`, err.message);
  }
}
