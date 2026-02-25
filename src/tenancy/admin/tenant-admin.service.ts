import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus, TenantPlan } from '../entities/tenant.entity';
import { TenantConfig } from '../entities/tenant-config.entity';
import { TenantBilling } from '../entities/tenant-billing.entity';
import { TenantCustomization } from '../entities/tenant-customization.entity';

export interface TenantStatistics {
  totalUsers: number;
  activeUsers: number;
  storageUsed: number;
  apiCalls: number;
  lastActivityAt?: Date;
}

export interface TenantHealth {
  status: string;
  issues: string[];
  score: number;
}

@Injectable()
export class TenantAdminService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(TenantConfig)
    private readonly configRepository: Repository<TenantConfig>,
    @InjectRepository(TenantBilling)
    private readonly billingRepository: Repository<TenantBilling>,
    @InjectRepository(TenantCustomization)
    private readonly customizationRepository: Repository<TenantCustomization>,
  ) {}

  /**
   * Get tenant statistics
   */
  async getTenantStatistics(tenantId: string): Promise<TenantStatistics> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const billing = await this.billingRepository.findOne({ where: { tenantId } });

    return {
      totalUsers: tenant.currentUserCount,
      activeUsers: billing?.usageMetrics?.activeUsers || 0,
      storageUsed: tenant.currentStorageUsage,
      apiCalls: billing?.usageMetrics?.apiCalls || 0,
      lastActivityAt: tenant.updatedAt,
    };
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(tenantId: string, reason?: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    tenant.status = TenantStatus.SUSPENDED;
    tenant.metadata = {
      ...tenant.metadata,
      suspensionReason: reason,
      suspendedAt: new Date(),
    };

    return await this.tenantRepository.save(tenant);
  }

  /**
   * Activate tenant
   */
  async activateTenant(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    tenant.status = TenantStatus.ACTIVE;
    tenant.metadata = {
      ...tenant.metadata,
      suspensionReason: undefined,
      suspendedAt: undefined,
      activatedAt: new Date(),
    };

    return await this.tenantRepository.save(tenant);
  }

  /**
   * Upgrade tenant plan
   */
  async upgradePlan(tenantId: string, newPlan: TenantPlan): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const oldPlan = tenant.plan;
    tenant.plan = newPlan;

    // Update limits based on plan
    const limits = this.getPlanLimits(newPlan);
    tenant.userLimit = limits.userLimit;
    tenant.storageLimit = limits.storageLimit;

    tenant.metadata = {
      ...tenant.metadata,
      planUpgradeHistory: [
        ...(tenant.metadata?.planUpgradeHistory || []),
        {
          from: oldPlan,
          to: newPlan,
          upgradedAt: new Date(),
        },
      ],
    };

    return await this.tenantRepository.save(tenant);
  }

  /**
   * Check tenant health
   */
  async checkTenantHealth(tenantId: string): Promise<TenantHealth> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const issues: string[] = [];
    let score = 100;

    // Check if tenant is suspended
    if (tenant.status === TenantStatus.SUSPENDED) {
      issues.push('Tenant is suspended');
      score -= 50;
    }

    // Check if approaching user limit
    const userUsagePercent = (tenant.currentUserCount / tenant.userLimit) * 100;
    if (userUsagePercent > 90) {
      issues.push('Approaching user limit');
      score -= 10;
    }

    // Check if approaching storage limit
    const storageUsagePercent = (tenant.currentStorageUsage / tenant.storageLimit) * 100;
    if (storageUsagePercent > 90) {
      issues.push('Approaching storage limit');
      score -= 10;
    }

    // Check billing status
    const billing = await this.billingRepository.findOne({ where: { tenantId } });
    if (billing && Number(billing.currentBalance) > 0) {
      issues.push('Outstanding billing balance');
      score -= 15;
    }

    // Check if trial expired
    if (tenant.status === TenantStatus.TRIAL && tenant.trialEndsAt && tenant.trialEndsAt < new Date()) {
      issues.push('Trial period expired');
      score -= 20;
    }

    return {
      status: score > 70 ? 'healthy' : score > 40 ? 'warning' : 'critical',
      issues,
      score,
    };
  }

  /**
   * Reset tenant data
   */
  async resetTenantData(tenantId: string): Promise<void> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Reset counters
    tenant.currentUserCount = 0;
    tenant.currentStorageUsage = 0;
    await this.tenantRepository.save(tenant);

    // Reset billing
    const billing = await this.billingRepository.findOne({ where: { tenantId } });
    if (billing) {
      billing.usageMetrics = {};
      await this.billingRepository.save(billing);
    }
  }

  /**
   * Export tenant data
   */
  async exportTenantData(tenantId: string): Promise<any> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    const config = await this.configRepository.findOne({ where: { tenantId } });
    const billing = await this.billingRepository.findOne({ where: { tenantId } });
    const customization = await this.customizationRepository.findOne({ where: { tenantId } });

    return {
      tenant,
      config,
      billing,
      customization,
      exportedAt: new Date(),
    };
  }

  /**
   * Get all tenants with pagination
   */
  async getAllTenants(page: number = 1, limit: number = 10): Promise<{ tenants: Tenant[]; total: number }> {
    const [tenants, total] = await this.tenantRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { tenants, total };
  }

  /**
   * Search tenants
   */
  async searchTenants(query: string): Promise<Tenant[]> {
    return await this.tenantRepository
      .createQueryBuilder('tenant')
      .where('tenant.name ILIKE :query', { query: `%${query}%` })
      .orWhere('tenant.slug ILIKE :query', { query: `%${query}%` })
      .orWhere('tenant.domain ILIKE :query', { query: `%${query}%` })
      .getMany();
  }

  /**
   * Get plan limits
   */
  private getPlanLimits(plan: TenantPlan): { userLimit: number; storageLimit: number } {
    const limits = {
      [TenantPlan.FREE]: { userLimit: 10, storageLimit: 1024 }, // 1GB
      [TenantPlan.BASIC]: { userLimit: 50, storageLimit: 10240 }, // 10GB
      [TenantPlan.PROFESSIONAL]: { userLimit: 200, storageLimit: 51200 }, // 50GB
      [TenantPlan.ENTERPRISE]: { userLimit: -1, storageLimit: -1 }, // Unlimited
    };

    return limits[plan] || limits[TenantPlan.FREE];
  }
}
