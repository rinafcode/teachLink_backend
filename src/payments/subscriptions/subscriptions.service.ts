import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  PaymentRequiredException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionInterval,
} from '../entities/subscription.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PauseSubscriptionDto,
  ResumeSubscriptionDto,
  UpgradeSubscriptionDto,
  DowngradeSubscriptionDto,
} from './dto/subscription-action.dto';
import { PaymentProviderService } from '../providers/payment-provider.service';

/**
 * Handles subscription lifecycle management including pause, resume, upgrade, downgrade.
 *
 * Issue #1007 — upgradeSubscription and downgradeSubscription now:
 *  1. Compute the prorated amount/credit BEFORE mutating the subscription.
 *  2. Attempt the charge or credit via PaymentProviderService.
 *  3. Only persist the plan change after the payment succeeds.
 *  4. Leave the subscription on its original plan if the charge fails.
 *  5. Record the provider chargeId / creditId on the subscription for reconciliation.
 *  6. Honour prorationType='none' by deferring the plan change to currentPeriodEnd.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private eventEmitter: EventEmitter2,
    private paymentProviderService: PaymentProviderService,
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
  async pauseSubscription(
    subscriptionId: string,
    dto: PauseSubscriptionDto,
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot pause subscription with status: ${subscription.status}. Must be active.`,
      );
    }

    // Update subscription status to PAUSED
    subscription.status = SubscriptionStatus.PAUSED;
    subscription.properties = {
      ...subscription.properties,
      pausedAt: new Date(),
      pauseReason: dto.reason,
      resumeAt: dto.resumeAt,
      isPaused: true,
    };

    const updated = await this.subscriptionRepository.save(subscription);

    // TODO: Schedule automatic resume if resumeAt is provided.
    // This requires injecting queueService and QUEUE_NAMES constants.
    // const resumeAtDate = dto.resumeAt ? new Date(dto.resumeAt) : undefined;
    // if (resumeAtDate) {
    //   const delayMs = resumeAtDate.getTime() - Date.now();
    //   if (delayMs > 0) {
    //     await this.queueService.addJob(
    //       QUEUE_NAMES.SUBSCRIPTIONS,
    //       JOB_NAMES.RESUME_SUBSCRIPTION,
    //       { subscriptionId: updated.id },
    //       {
    //         delay: delayMs,
    //         attempts: 3,
    //         backoff: {
    //           type: 'exponential',
    //           delay: 5000,
    //         },
    //       },
    //     );
    //   }
    // }

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
  async resumeSubscription(
    subscriptionId: string,
    dto: ResumeSubscriptionDto,
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);

    if (subscription.status !== SubscriptionStatus.PAUSED) {
      throw new BadRequestException('Subscription is not paused');
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.cancelAtPeriodEnd = false;
    subscription.properties = {
      ...subscription.properties,
      isPaused: false,
      resumedAt: new Date(),
      resumeReason: dto.reason,
    };

    const updated = await this.subscriptionRepository.save(subscription);

    this.eventEmitter.emit('subscription.resumed', {
      subscriptionId: updated.id,
      userId: updated.userId,
      reason: dto.reason,
    });

    this.logger.log(`Subscription ${subscriptionId} resumed by user ${subscription.userId}`);

    return updated;
  }

  /**
   * Upgrade subscription to a higher-priced plan.
   *
   * Order of operations (Issue #1007):
   *  1. Validate state.
   *  2. Compute proratedAmount (net charge = new prorated charge − old prorated credit).
   *  3. Charge the customer via the payment provider.
   *  4. Only if the charge succeeds: update the plan and persist.
   *  5. On charge failure: leave subscription unchanged and rethrow.
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

    // Compute proration — do this before any mutation so a failed charge
    // leaves the subscription record untouched.
    const daysRemaining = this.calculateDaysRemaining(subscription.currentPeriodEnd);
    const totalDaysInPeriod = this.calculateDaysInPeriod(subscription.interval);
    const proratedCredit = this.calculateProratedAmount(
      oldAmount,
      daysRemaining,
      totalDaysInPeriod,
    );
    const proratedCharge = this.calculateProratedAmount(
      newAmount,
      daysRemaining,
      totalDaysInPeriod,
    );
    const proratedAmount = proratedCharge - proratedCredit;

    // Attempt the charge BEFORE mutating the subscription (Issue #1007).
    let chargeId: string;
    try {
      const chargeResult = await this.paymentProviderService.chargeCustomer(
        subscription.userId,
        proratedAmount,
        subscription.currency,
        {
          subscriptionId,
          oldPlanAmount: oldAmount,
          newPlanId: dto.planId,
          type: 'subscription_upgrade_proration',
        },
      );
      chargeId = chargeResult.chargeId;
    } catch (err) {
      // Charge failed — subscription is NOT mutated. Propagate so the
      // controller returns 402 / 400 and the DB record stays on the old plan.
      this.logger.warn(
        `Prorated upgrade charge failed for subscription ${subscriptionId}: ${(err as Error).message}`,
      );
      throw new PaymentRequiredException(
        `Prorated charge of ${proratedAmount} ${subscription.currency} failed: ${(err as Error).message}`,
      );
    }

    // Payment confirmed — now update the subscription.
    subscription.amount = newAmount;
    subscription.interval = dto.billingCycle
      ? (dto.billingCycle as SubscriptionInterval)
      : subscription.interval;
    subscription.properties = {
      ...subscription.properties,
      upgradedFrom: { planId: subscription.properties?.planId, amount: oldAmount },
      upgradedAt: new Date(),
      proratedAmount,
      proratedCredit,
      proratedCharge,
      // Record the provider charge ID for reconciliation (Issue #1007).
      upgradeChargeId: chargeId,
    };

    const updated = await this.subscriptionRepository.save(subscription);

    this.eventEmitter.emit('subscription.upgraded', {
      subscriptionId: updated.id,
      userId: updated.userId,
      oldAmount,
      newAmount,
      proratedAmount,
      chargeId,
      planId: dto.planId,
    });

    this.logger.log(
      `Subscription ${subscriptionId} upgraded from $${oldAmount} to $${newAmount} ` +
        `(prorated charge: $${proratedAmount}, chargeId: ${chargeId})`,
    );

    return updated;
  }

  /**
   * Downgrade subscription to a lower-priced plan.
   *
   * prorationType controls behaviour (Issue #1007):
   *  - 'credit'  (default) — issue a prorated credit immediately, then apply the lower plan now.
   *  - 'none'              — defer the plan change to currentPeriodEnd (no credit issued now).
   *
   * In both cases the subscription record is only mutated after the provider
   * call returns successfully.
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

    const prorationType = dto.prorationType ?? 'credit';

    // 'none' — defer the plan change to the end of the current period.
    // No charge or credit is issued now; the actual plan switch will be
    // handled when the subscription renews.
    if (prorationType === 'none') {
      subscription.cancelAtPeriodEnd = false;
      subscription.properties = {
        ...subscription.properties,
        pendingDowngrade: {
          planId: dto.planId,
          amount: newAmount,
          billingCycle: dto.billingCycle,
          scheduledAt: new Date(),
          effectiveAt: subscription.currentPeriodEnd,
        },
        downgradedFrom: { planId: subscription.properties?.planId, amount: oldAmount },
        prorationType,
      };

      const updated = await this.subscriptionRepository.save(subscription);

      this.eventEmitter.emit('subscription.downgraded', {
        subscriptionId: updated.id,
        userId: updated.userId,
        oldAmount,
        newAmount,
        prorationType,
        deferred: true,
        effectiveAt: subscription.currentPeriodEnd,
        planId: dto.planId,
      });

      this.logger.log(
        `Subscription ${subscriptionId} downgrade deferred to ${subscription.currentPeriodEnd.toISOString()} ` +
          `(new plan: ${dto.planId}, prorationType: none)`,
      );

      return updated;
    }

    // 'credit' (or any other value) — issue the prorated credit immediately
    // and apply the lower plan now.
    const daysRemaining = this.calculateDaysRemaining(subscription.currentPeriodEnd);
    const totalDaysInPeriod = this.calculateDaysInPeriod(subscription.interval);
    const oldProratedCharge = this.calculateProratedAmount(
      oldAmount,
      daysRemaining,
      totalDaysInPeriod,
    );
    const newProratedCharge = this.calculateProratedAmount(
      newAmount,
      daysRemaining,
      totalDaysInPeriod,
    );
    const proratedCredit = oldProratedCharge - newProratedCharge;

    // Issue the credit BEFORE mutating the subscription (Issue #1007).
    let creditId: string;
    try {
      const creditResult = await this.paymentProviderService.issueCredit(
        subscription.userId,
        proratedCredit,
        subscription.currency,
        {
          subscriptionId,
          oldPlanAmount: oldAmount,
          newPlanId: dto.planId,
          type: 'subscription_downgrade_proration',
        },
      );
      creditId = creditResult.creditId;
    } catch (err) {
      // Credit issuance failed — subscription is NOT mutated.
      this.logger.warn(
        `Prorated credit issuance failed for subscription ${subscriptionId}: ${(err as Error).message}`,
      );
      throw new BadRequestException(
        `Failed to issue prorated credit of ${proratedCredit} ${subscription.currency}: ${(err as Error).message}`,
      );
    }

    // Credit confirmed — now apply the lower plan.
    subscription.amount = newAmount;
    subscription.interval = dto.billingCycle
      ? (dto.billingCycle as SubscriptionInterval)
      : subscription.interval;
    subscription.properties = {
      ...subscription.properties,
      downgradedFrom: { planId: subscription.properties?.planId, amount: oldAmount },
      downgradedAt: new Date(),
      prorationType,
      proratedCredit,
      // Record the provider credit ID for reconciliation (Issue #1007).
      downgradeCreditId: creditId,
    };

    const updated = await this.subscriptionRepository.save(subscription);

    this.eventEmitter.emit('subscription.downgraded', {
      subscriptionId: updated.id,
      userId: updated.userId,
      oldAmount,
      newAmount,
      proratedCredit,
      creditId,
      prorationType,
      deferred: false,
      planId: dto.planId,
    });

    this.logger.log(
      `Subscription ${subscriptionId} downgraded from $${oldAmount} to $${newAmount} ` +
        `(prorated credit: $${proratedCredit}, creditId: ${creditId})`,
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

    // Skip paused subscriptions - they should not be renewed
    if (subscription.status === SubscriptionStatus.PAUSED) {
      this.logger.log(`Skipping renewal for paused subscription ${subscriptionId}`);
      return false;
    }

    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.PAST_DUE
    ) {
      this.logger.warn(
        `Cannot renew subscription ${subscriptionId} with status: ${subscription.status}`,
      );
      return false;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(
          `Attempting renewal for subscription ${subscriptionId} (attempt ${attempt}/${maxRetries})`,
        );

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

        this.logger.log(
          `Subscription ${subscriptionId} renewed successfully on attempt ${attempt}`,
        );
        return true;
      } catch (err) {
        this.logger.warn(
          `Renewal attempt ${attempt} failed for subscription ${subscriptionId}: ${(err as Error).message}`,
        );

        if (attempt === maxRetries) {
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

  // ---------------------------------------------------------------------------
  // Helper methods
  // ---------------------------------------------------------------------------

  private async getNewPlanAmount(planId: string, billingCycle?: string): Promise<number> {
    // Static plan price map — replace with a PlanService / DB lookup when available.
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

  private calculateProratedAmount(
    amount: number,
    daysRemaining: number,
    totalDaysInPeriod: number,
  ): number {
    // Convert to cents to avoid floating-point precision errors
    const amountInCents = Math.round(amount * 100);
    const proratedCents = Math.round((amountInCents * daysRemaining) / totalDaysInPeriod);
    // Convert back to dollars
    return proratedCents / 100;
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
    return { success: true };
  }
}
