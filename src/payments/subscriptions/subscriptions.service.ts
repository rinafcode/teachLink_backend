import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionStatus, SubscriptionInterval } from '../entities/subscription.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PauseSubscriptionDto,
  ResumeSubscriptionDto,
  UpgradeSubscriptionDto,
  DowngradeSubscriptionDto,
} from './dto/subscription-action.dto';

/**
 * Handles subscription lifecycle management including pause, resume, upgrade, downgrade
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
      relations: ['user'],
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    return subscription;
  }

  /**
   * Get user's active subscription
   */
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findOne({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      relations: ['user'],
    });
  }

  /**
   * Pause a subscription
   */
  async pauseSubscription(subscriptionId: string, dto: PauseSubscriptionDto): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot pause subscription with status: ${subscription.status}. Must be active.`,
      );
    }

    // Update subscription with pause metadata without canceling the subscription.
    subscription.properties = {
      ...subscription.properties,
      pausedAt: new Date(),
      pauseReason: dto.reason,
      resumeAt: dto.resumeAt,
      isPaused: true,
    };

    const updated = await this.subscriptionRepository.save(subscription);

    // Emit event for downstream processing (notify user, analytics, etc.)
    this.eventEmitter.emit('subscription.paused', {
      subscriptionId: updated.id,
      userId: updated.userId,
      resumeAt: dto.resumeAt,
      reason: dto.reason,
    });

    this.logger.log(`Subscription ${subscriptionId} paused by user ${subscription.userId}`);

    return updated;
  }

  /**
   * Resume a paused subscription
   */
  async resumeSubscription(subscriptionId: string, dto: ResumeSubscriptionDto): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);

    if (!subscription.properties?.isPaused) {
      throw new BadRequestException('Subscription is not paused');
    }

    // Update subscription to active
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.cancelAtPeriodEnd = false;
    subscription.properties = {
      ...subscription.properties,
      isPaused: false,
      resumedAt: new Date(),
      resumeReason: dto.reason,
    };

    const updated = await this.subscriptionRepository.save(subscription);

    // Emit event for downstream processing
    this.eventEmitter.emit('subscription.resumed', {
      subscriptionId: updated.id,
      userId: updated.userId,
      reason: dto.reason,
    });

    this.logger.log(`Subscription ${subscriptionId} resumed by user ${subscription.userId}`);

    return updated;
  }

  /**
   * Upgrade subscription to a different plan
   */
  async upgradeSubscription(
    subscriptionId: string,
    dto: UpgradeSubscriptionDto,
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot upgrade subscription with status: ${subscription.status}. Must be active.`,
      );
    }

    const oldAmount = subscription.amount;
    const newAmount = await this.getNewPlanAmount(dto.planId, dto.billingCycle);

    if (newAmount <= oldAmount) {
      throw new BadRequestException(
        'Upgrade plan must have higher price. Use downgrade endpoint for plan changes to lower priced plans.',
      );
    }

    // Calculate prorated amount
    const daysRemaining = this.calculateDaysRemaining(subscription.currentPeriodEnd);
    const totalDaysInPeriod = this.calculateDaysInPeriod(subscription.interval);
    const proratedCredit = (oldAmount * daysRemaining) / totalDaysInPeriod;
    const proratedCharge = (newAmount * daysRemaining) / totalDaysInPeriod;
    const proratedAmount = proratedCharge - proratedCredit;

    // Update subscription
    subscription.amount = newAmount;
    subscription.interval = dto.billingCycle ? (dto.billingCycle as SubscriptionInterval) : subscription.interval;
    subscription.properties = {
      ...subscription.properties,
      upgradedFrom: { planId: subscription.properties?.planId, amount: oldAmount },
      upgradedAt: new Date(),
      proratedAmount,
      proratedCredit,
      proratedCharge,
    };

    const updated = await this.subscriptionRepository.save(subscription);

    // Emit event for payment processing
    this.eventEmitter.emit('subscription.upgraded', {
      subscriptionId: updated.id,
      userId: updated.userId,
      oldAmount,
      newAmount,
      proratedAmount,
      planId: dto.planId,
    });

    this.logger.log(
      `Subscription ${subscriptionId} upgraded from $${oldAmount} to $${newAmount} (prorated: $${proratedAmount})`,
    );

    return updated;
  }

  /**
   * Downgrade subscription to a different plan
   */
  async downgradeSubscription(
    subscriptionId: string,
    dto: DowngradeSubscriptionDto,
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot downgrade subscription with status: ${subscription.status}. Must be active.`,
      );
    }

    const oldAmount = subscription.amount;
    const newAmount = await this.getNewPlanAmount(dto.planId, dto.billingCycle);

    if (newAmount >= oldAmount) {
      throw new BadRequestException(
        'Downgrade plan must have lower price. Use upgrade endpoint for plan changes to higher priced plans.',
      );
    }

    // Calculate prorated credit based on prorationType
    const daysRemaining = this.calculateDaysRemaining(subscription.currentPeriodEnd);
    const totalDaysInPeriod = this.calculateDaysInPeriod(subscription.interval);
    const proratedCharge = (newAmount * daysRemaining) / totalDaysInPeriod;
    const oldProratedCharge = (oldAmount * daysRemaining) / totalDaysInPeriod;
    const proratedCredit = oldProratedCharge - proratedCharge;
    const prorationType = dto.prorationType || 'credit';

    // Update subscription
    subscription.amount = newAmount;
    subscription.interval = dto.billingCycle ? (dto.billingCycle as SubscriptionInterval) : subscription.interval;
    subscription.properties = {
      ...subscription.properties,
      downgradedFrom: { planId: subscription.properties?.planId, amount: oldAmount },
      downgradedAt: new Date(),
      prorationType,
      proratedCredit,
      proratedCharge,
    };

    const updated = await this.subscriptionRepository.save(subscription);

    // Emit event for payment/credit processing
    this.eventEmitter.emit('subscription.downgraded', {
      subscriptionId: updated.id,
      userId: updated.userId,
      oldAmount,
      newAmount,
      proratedCredit,
      prorationType,
      planId: dto.planId,
    });

    this.logger.log(
      `Subscription ${subscriptionId} downgraded from $${oldAmount} to $${newAmount} (credit: $${proratedCredit})`,
    );

    return updated;
  }

  async cancelSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelAtPeriodEnd = true;
    subscription.cancelledAt = new Date();
    subscription.properties = {
      ...subscription.properties,
      cancelledBy: 'user',
      cancelledAt: new Date(),
    };

    const updated = await this.subscriptionRepository.save(subscription);

    this.eventEmitter.emit('subscription.cancelled', {
      subscriptionId: updated.id,
      userId: updated.userId,
    });

    this.logger.log(`Subscription ${subscriptionId} cancelled for user ${subscription.userId}`);
    return updated;
  }

  /**
   * Process subscription renewal with retry logic
   */
  async processRenewal(subscriptionId: string, maxRetries = 3): Promise<boolean> {
    const subscription = await this.getSubscription(subscriptionId);

    if (subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.PAST_DUE) {
      this.logger.warn(`Cannot renew subscription ${subscriptionId} with status: ${subscription.status}`);
      return false;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Attempting renewal for subscription ${subscriptionId} (attempt ${attempt}/${maxRetries})`);

        // Emit event for payment processor to handle
        this.eventEmitter.emit('subscription.renewal_attempt', {
          subscriptionId,
          userId: subscription.userId,
          amount: subscription.amount,
          attempt,
          maxRetries,
        });

        // Simulate successful renewal
        subscription.currentPeriodStart = new Date();
        subscription.currentPeriodEnd = this.calculateNextPeriodEnd(subscription.interval);
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.properties = {
          ...subscription.properties,
          lastRenewalAttempt: new Date(),
          lastSuccessfulRenewal: new Date(),
          renewalAttempts: (subscription.properties?.renewalAttempts || 0) + 1,
        };

        await this.subscriptionRepository.save(subscription);

        this.eventEmitter.emit('subscription.renewed', {
          subscriptionId: subscription.id,
          userId: subscription.userId,
        });

        this.logger.log(`Subscription ${subscriptionId} renewed successfully on attempt ${attempt}`);
        return true;
      } catch (err) {
        this.logger.warn(
          `Renewal attempt ${attempt} failed for subscription ${subscriptionId}: ${(err as Error).message}`,
        );

        if (attempt === maxRetries) {
          // Mark as past due after all retries exhausted
          subscription.status = SubscriptionStatus.PAST_DUE;
          subscription.properties = {
            ...subscription.properties,
            failedRenewalAttempts: (subscription.properties?.failedRenewalAttempts || 0) + 1,
            lastFailedRenewal: new Date(),
          };

          await this.subscriptionRepository.save(subscription);

          this.eventEmitter.emit('subscription.renewal_failed', {
            subscriptionId: subscription.id,
            userId: subscription.userId,
            attempts: maxRetries,
          });

          this.logger.error(`All renewal attempts failed for subscription ${subscriptionId}`);
          return false;
        }

        // Exponential backoff before next attempt
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    return false;
  }

  /**
   * Schedule renewal retry for failed subscriptions
   */
  async scheduleRenewalRetry(subscriptionId: string, delayMs = 300000): Promise<void> {
    this.logger.log(`Scheduling renewal retry for subscription ${subscriptionId} in ${delayMs}ms`);

    setTimeout(() => {
      this.processRenewal(subscriptionId).catch((err) => {
        this.logger.error(`Scheduled renewal retry failed for ${subscriptionId}`, err as Error);
      });
    }, delayMs);
  }

  // Helper methods
  private async getNewPlanAmount(planId: string, billingCycle?: string): Promise<number> {
    // For now, use an in-app plan price map; replace with a plan service or database lookup when available.
    const planPrices: Record<string, number> = {
      'plan-basic': 9.99,
      'plan-pro': 19.99,
      'plan-enterprise': 49.99,
    };

    let amount = planPrices[planId];
    if (amount === undefined) {
      throw new BadRequestException(`Unknown plan ID: ${planId}`);
    }

    if (billingCycle === SubscriptionInterval.YEARLY) {
      amount = Number((amount * 10).toFixed(2));
    } else if (billingCycle === SubscriptionInterval.QUARTERLY) {
      amount = Number((amount * 2.75).toFixed(2));
    } else if (billingCycle === SubscriptionInterval.WEEKLY) {
      amount = Number((amount / 4).toFixed(2));
    }

    return amount;
  }

  private calculateDaysRemaining(endDate: Date): number {
    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  private calculateDaysInPeriod(interval: SubscriptionInterval): number {
    const intervalDays: Record<SubscriptionInterval, number> = {
      [SubscriptionInterval.WEEKLY]: 7,
      [SubscriptionInterval.MONTHLY]: 30,
      [SubscriptionInterval.QUARTERLY]: 90,
      [SubscriptionInterval.YEARLY]: 365,
    };

    return intervalDays[interval] || 30;
  }

  private calculateNextPeriodEnd(interval: SubscriptionInterval): Date {
    const now = new Date();
    const daysToAdd = this.calculateDaysInPeriod(interval);
    return new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  }

  /**
   * Legacy placeholder - for backward compatibility
   */
  async processSubscription(): Promise<unknown> {
    // Logic to process subscription payments
    return { success: true };
  }
}
