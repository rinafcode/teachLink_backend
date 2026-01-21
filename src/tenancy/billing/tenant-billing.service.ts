import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantBilling, BillingCycle } from '../entities/tenant-billing.entity';
import { Tenant } from '../entities/tenant.entity';
import { IsolationService } from '../isolation/isolation.service';

export interface UsageMetrics {
  activeUsers?: number;
  storageUsed?: number;
  apiCalls?: number;
  bandwidth?: number;
  [key: string]: any;
}

export interface BillingRecord {
  date: Date;
  amount: number;
  status: string;
  invoiceId?: string;
}

@Injectable()
export class TenantBillingService {
  constructor(
    @InjectRepository(TenantBilling)
    private readonly billingRepository: Repository<TenantBilling>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  /**
   * Get billing information for a tenant
   */
  async getBillingInfo(tenantId: string): Promise<TenantBilling> {
    const billing = await this.billingRepository.findOne({ where: { tenantId } });
    if (!billing) {
      throw new NotFoundException(`Billing info not found for tenant ${tenantId}`);
    }
    return billing;
  }

  /**
   * Create billing record for a tenant
   */
  async createBillingRecord(tenantId: string, billingCycle: BillingCycle = BillingCycle.MONTHLY): Promise<TenantBilling> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const billing = this.billingRepository.create({
      tenantId,
      billingCycle,
      monthlyFee: this.calculateMonthlyFee(tenant.plan),
      nextBillingDate: this.calculateNextBillingDate(billingCycle),
    });

    return await this.billingRepository.save(billing);
  }

  /**
   * Update usage metrics
   */
  async updateUsageMetrics(tenantId: string, metrics: UsageMetrics): Promise<TenantBilling> {
    const billing = await this.getBillingInfo(tenantId);
    
    billing.usageMetrics = {
      ...billing.usageMetrics,
      ...metrics,
    };

    return await this.billingRepository.save(billing);
  }

  /**
   * Record a payment
   */
  async recordPayment(
    tenantId: string,
    amount: number,
    invoiceId?: string,
  ): Promise<TenantBilling> {
    const billing = await this.getBillingInfo(tenantId);

    const billingRecord: BillingRecord = {
      date: new Date(),
      amount,
      status: 'paid',
      invoiceId,
    };

    billing.billingHistory = billing.billingHistory || [];
    billing.billingHistory.push(billingRecord);
    billing.totalPaid = Number(billing.totalPaid) + amount;
    billing.currentBalance = Number(billing.currentBalance) - amount;
    billing.lastBillingDate = new Date();

    return await this.billingRepository.save(billing);
  }

  /**
   * Generate invoice
   */
  async generateInvoice(tenantId: string): Promise<BillingRecord> {
    const billing = await this.getBillingInfo(tenantId);
    const amount = Number(billing.monthlyFee);

    const invoice: BillingRecord = {
      date: new Date(),
      amount,
      status: 'pending',
      invoiceId: `INV-${tenantId}-${Date.now()}`,
    };

    billing.currentBalance = Number(billing.currentBalance) + amount;
    billing.billingHistory = billing.billingHistory || [];
    billing.billingHistory.push(invoice);
    billing.nextBillingDate = this.calculateNextBillingDate(billing.billingCycle);

    await this.billingRepository.save(billing);

    return invoice;
  }

  /**
   * Update billing cycle
   */
  async updateBillingCycle(tenantId: string, billingCycle: BillingCycle): Promise<TenantBilling> {
    const billing = await this.getBillingInfo(tenantId);
    billing.billingCycle = billingCycle;
    billing.nextBillingDate = this.calculateNextBillingDate(billingCycle);
    return await this.billingRepository.save(billing);
  }

  /**
   * Get billing history
   */
  async getBillingHistory(tenantId: string): Promise<BillingRecord[]> {
    const billing = await this.getBillingInfo(tenantId);
    return billing.billingHistory || [];
  }

  /**
   * Calculate current usage cost
   */
  async calculateUsageCost(tenantId: string): Promise<number> {
    const billing = await this.getBillingInfo(tenantId);
    const metrics = billing.usageMetrics || {};

    let cost = 0;

    // Example pricing logic (customize as needed)
    cost += (metrics.activeUsers || 0) * 5; // $5 per active user
    cost += ((metrics.storageUsed || 0) / 1024) * 0.1; // $0.10 per GB
    cost += ((metrics.apiCalls || 0) / 1000) * 0.01; // $0.01 per 1000 API calls

    return cost;
  }

  /**
   * Check if tenant has outstanding balance
   */
  async hasOutstandingBalance(tenantId: string): Promise<boolean> {
    const billing = await this.getBillingInfo(tenantId);
    return Number(billing.currentBalance) > 0;
  }

  /**
   * Update Stripe customer ID
   */
  async updateStripeCustomer(tenantId: string, customerId: string, subscriptionId?: string): Promise<TenantBilling> {
    const billing = await this.getBillingInfo(tenantId);
    billing.stripeCustomerId = customerId;
    if (subscriptionId) {
      billing.stripeSubscriptionId = subscriptionId;
    }
    return await this.billingRepository.save(billing);
  }

  /**
   * Calculate monthly fee based on plan
   */
  private calculateMonthlyFee(plan: string): number {
    const pricing = {
      free: 0,
      basic: 29,
      professional: 99,
      enterprise: 299,
    };
    return pricing[plan] || 0;
  }

  /**
   * Calculate next billing date based on cycle
   */
  private calculateNextBillingDate(cycle: BillingCycle): Date {
    const now = new Date();
    switch (cycle) {
      case BillingCycle.MONTHLY:
        return new Date(now.setMonth(now.getMonth() + 1));
      case BillingCycle.QUARTERLY:
        return new Date(now.setMonth(now.getMonth() + 3));
      case BillingCycle.YEARLY:
        return new Date(now.setFullYear(now.getFullYear() + 1));
      default:
        return new Date(now.setMonth(now.getMonth() + 1));
    }
  }
}
