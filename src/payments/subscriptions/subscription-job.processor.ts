import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';

import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionStatus } from '../entities/subscription.entity';
import { IPaymentProvider } from '../providers/payment-provider.interface';

@Processor(QUEUE_NAMES.SUBSCRIPTIONS)
export class SubscriptionJobProcessor {
  private readonly logger = new Logger(SubscriptionJobProcessor.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @Inject('IPaymentProvider')
    private paymentProvider: IPaymentProvider,
  ) {}

  @Process(JOB_NAMES.PROCESS_SUBSCRIPTION)
  async handleSubscription(job: Job<unknown>): Promise<unknown> {
    // Process subscription job
    this.logger.log('Processing subscription job:', job.data);
    return { success: true };
  }

  @Process(JOB_NAMES.RESUME_SUBSCRIPTION)
  async handleResumeSubscription(
    job: Job<{ subscriptionId: string }>,
  ): Promise<{ success: boolean; message: string }> {
    const { subscriptionId } = job.data;

    try {
      this.logger.log(`Processing resume subscription job for ${subscriptionId}`);

      const subscription = await this.subscriptionRepository.findOne({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        this.logger.error(`Subscription ${subscriptionId} not found`);
        return { success: false, message: 'Subscription not found' };
      }

      if (subscription.status !== SubscriptionStatus.PAUSED) {
        this.logger.warn(
          `Subscription ${subscriptionId} is not paused (status: ${subscription.status})`,
        );
        return { success: false, message: 'Subscription is not paused' };
      }

      if (!subscription.providerSubscriptionId) {
        this.logger.error(`Subscription ${subscriptionId} has no provider subscription ID`);
        return { success: false, message: 'No provider subscription ID' };
      }

      // Resume at provider (Stripe) first
      try {
        await this.paymentProvider.resumeSubscription(subscription.providerSubscriptionId);
      } catch (error) {
        this.logger.error(`Failed to resume subscription ${subscriptionId} at provider`, error);
        return { success: false, message: 'Provider resume failed' };
      }

      // Resume the subscription locally only after provider succeeds
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.cancelAtPeriodEnd = false;
      subscription.properties = {
        ...subscription.properties,
        isPaused: false,
        resumedAt: new Date(),
        resumeReason: 'Scheduled automatic resume',
      };

      await this.subscriptionRepository.save(subscription);

      this.logger.log(`Successfully resumed subscription ${subscriptionId} via scheduled job`);

      return { success: true, message: 'Subscription resumed successfully' };
    } catch (error) {
      this.logger.error(`Failed to resume subscription ${subscriptionId}`, error);
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
