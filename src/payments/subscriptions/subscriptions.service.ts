import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus, BillingInterval } from '../enums';
import { StripeService } from '../providers/stripe.service';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly stripeService: StripeService,
  ) {}

  async createSubscription(
    createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<Subscription> {
    try {
      const {
        userId,
        courseId,
        amount,
        currency,
        billingInterval,
        trialEnd,
        metadata,
      } = createSubscriptionDto;

      // Create or get Stripe customer
      const customer = await this.stripeService.createCustomer(userId);

      // Create price ID based on billing interval (in production, you'd have predefined prices)
      const priceId = await this.createPriceId(
        amount,
        currency,
        billingInterval,
      );

      // Calculate trial end timestamp if provided
      const trialEndTimestamp = trialEnd
        ? Math.floor(new Date(trialEnd).getTime() / 1000)
        : undefined;

      // Create subscription in Stripe
      const stripeSubscription = await this.stripeService.createSubscription(
        customer.id,
        priceId,
        { userId, courseId, ...metadata },
        trialEndTimestamp,
      );

      // Create subscription record in database
      const subscription = this.subscriptionRepo.create({
        userId,
        courseId,
        amount,
        currency,
        billingInterval,
        status: SubscriptionStatus.ACTIVE,
        providerSubscriptionId: stripeSubscription.id,
        providerCustomerId: customer.id,
        currentPeriodStart: new Date(
          (stripeSubscription as any).current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(
          (stripeSubscription as any).current_period_end * 1000,
        ),
        trialEnd: trialEnd ? new Date(trialEnd) : null,
        metadata,
      });

      return await this.subscriptionRepo.save(subscription);
    } catch (error) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
      throw new BadRequestException('Failed to create subscription');
    }
  }

  async getSubscription(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id },
      relations: ['user', 'course'],
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    return subscription;
  }

  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { userId },
      relations: ['course'],
      order: { createdAt: 'DESC' },
    });
  }

  async cancelSubscription(id: string): Promise<Subscription> {
    const subscription = await this.getSubscription(id);

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    try {
      // Cancel in Stripe
      await this.stripeService.cancelSubscription(
        subscription.providerSubscriptionId,
      );

      // Update local record
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();

      return await this.subscriptionRepo.save(subscription);
    } catch (error) {
      this.logger.error(`Failed to cancel subscription: ${error.message}`);
      throw new BadRequestException('Failed to cancel subscription');
    }
  }

  async updateSubscriptionStatus(
    providerSubscriptionId: string,
    status: SubscriptionStatus,
    currentPeriodStart?: Date,
    currentPeriodEnd?: Date,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { providerSubscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException(
        `Subscription with provider ID ${providerSubscriptionId} not found`,
      );
    }

    subscription.status = status;
    if (currentPeriodStart)
      subscription.currentPeriodStart = currentPeriodStart;
    if (currentPeriodEnd) subscription.currentPeriodEnd = currentPeriodEnd;

    return await this.subscriptionRepo.save(subscription);
  }

  async getActiveSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { status: SubscriptionStatus.ACTIVE },
      relations: ['user', 'course'],
    });
  }

  async getExpiringSubscriptions(days: number = 7): Promise<Subscription[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    return this.subscriptionRepo
      .createQueryBuilder('subscription')
      .where('subscription.currentPeriodEnd <= :expiryDate', { expiryDate })
      .andWhere('subscription.status = :status', {
        status: SubscriptionStatus.ACTIVE,
      })
      .getMany();
  }

  private async createPriceId(
    amount: number,
    currency: string,
    interval: BillingInterval,
  ): Promise<string> {
    // In production, you'd create and cache price IDs
    // For now, return a mock price ID
    const intervalMap = {
      [BillingInterval.MONTHLY]: 'month',
      [BillingInterval.QUARTERLY]: 'quarter',
      [BillingInterval.YEARLY]: 'year',
    };

    // This would typically create a price in Stripe and return the ID
    // For demo purposes, return a mock ID
    return `price_${currency}_${amount}_${intervalMap[interval]}`;
  }
}
