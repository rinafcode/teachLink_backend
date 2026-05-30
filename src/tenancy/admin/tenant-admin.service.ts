import { Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../common/exceptions/app.exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { sanitizeSqlLike } from '../../common/utils/sanitization.utils';
import { Tenant, TenantStatus, TenantPlan } from '../entities/tenant.entity';
import { TenantConfig } from '../entities/tenant-config.entity';
import { TenantBilling } from '../entities/tenant-billing.entity';
import { TenantCustomization } from '../entities/tenant-customization.entity';
import { TENANT_PLAN_LIMITS, TENANT_HEALTH_SCORE, TENANT_DEFAULTS } from '../tenancy.constants';

export interface ITenantStatistics {
  totalUsers: number;
  activeUsers: number;
  storageUsed: number;
  apiCalls: number;
  lastActivityAt?: Date;
}

export interface ITenantHealth {
  status: string;
  issues: string[];
  score: number;
}

/**
 * Provides tenant Admin operations.
 */
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

  async getTenantStatistics(tenantId: string): Promise<ITenantStatistics> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new ResourceNotFoundException('Tenant', tenantId);
    }

    return {
      totalUsers: tenant.currentUserCount,
      activeUsers: tenant.currentUserCount,
      storageUsed: tenant.currentStorageUsage,
      apiCalls: 0,
      lastActivityAt: tenant.updatedAt,
    };
  }

  async suspendTenant(tenantId: string, reason?: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new ResourceNotFoundException('Tenant', tenantId);
    }
    tenant.status = TenantStatus.SUSPENDED;
    tenant.metadata = {
      ...tenant.metadata,
      suspensionReason: reason,
      suspendedAt: new Date(),
    };
    return await this.tenantRepository.save(tenant);
  }

  async activateTenant(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new ResourceNotFoundException('Tenant', tenantId);
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

  async upgradePlan(tenantId: string, newPlan: TenantPlan): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new ResourceNotFoundException('Tenant', tenantId);
    }
    const oldPlan = tenant.plan;
    tenant.plan = newPlan;
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

  async checkTenantHealth(tenantId: string): Promise<ITenantHealth> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new ResourceNotFoundException('Tenant', tenantId);
    }

    const issues: string[] = [];
    let score = TENANT_HEALTH_SCORE.MAX_SCORE;

    if (tenant.status === TenantStatus.SUSPENDED) {
      issues.push('Tenant is suspended');
      score -= TENANT_HEALTH_SCORE.SUSPENSION_PENALTY;
    }

    const userLimit = Math.max(tenant.userLimit, 1);
    const userUsagePercent = (tenant.currentUserCount / userLimit) * 100;
    if (userUsagePercent > TENANT_HEALTH_SCORE.USAGE_WARNING_PERCENT) {
      issues.push('Approaching user limit');
      score -= TENANT_HEALTH_SCORE.USAGE_LIMIT_PENALTY;
    }

    const storageLimit = Math.max(tenant.storageLimit, 1);
    const storageUsagePercent = (tenant.currentStorageUsage / storageLimit) * 100;
    if (storageUsagePercent > TENANT_HEALTH_SCORE.USAGE_WARNING_PERCENT) {
      issues.push('Approaching storage limit');
      score -= TENANT_HEALTH_SCORE.USAGE_LIMIT_PENALTY;
    }

    const billing = await this.billingRepository.findOne({ where: { tenantId } });
    if (billing && Number(billing.currentBalance) > 0) {
      issues.push('Outstanding billing balance');
      score -= TENANT_HEALTH_SCORE.OUTSTANDING_BALANCE_PENALTY;
    }

    if (
      tenant.status === TenantStatus.TRIAL &&
      tenant.trialEndsAt &&
      tenant.trialEndsAt < new Date()
    ) {
      issues.push('Trial period expired');
      score -= TENANT_HEALTH_SCORE.TRIAL_EXPIRED_PENALTY;
    }

    return {
      status:
        score > TENANT_HEALTH_SCORE.HEALTHY_THRESHOLD
          ? 'healthy'
          : score > TENANT_HEALTH_SCORE.WARNING_THRESHOLD
            ? 'warning'
            : 'critical',
      issues,
      score,
    };
  }

  async resetTenantData(tenantId: string): Promise<void> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new ResourceNotFoundException('Tenant', tenantId);
    }

    tenant.currentUserCount = 0;
    tenant.currentStorageUsage = 0;
    await this.tenantRepository.save(tenant);

    const billing = await this.billingRepository.findOne({ where: { tenantId } });
    if (billing) {
      billing.usageMetrics = {};
      await this.billingRepository.save(billing);
    }
  }

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

  async getAllTenants(
    page: number = 1,
    limit: number = TENANT_DEFAULTS.DEFAULT_PAGE_SIZE,
  ): Promise<{ tenants: Tenant[]; total: number }> {
    const [tenants, total] = await this.tenantRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { tenants, total };
  }

  async searchTenants(query: string): Promise<Tenant[]> {
    const safeQuery = sanitizeSqlLike(query);

    return await this.tenantRepository
      .createQueryBuilder('tenant')
      .where("tenant.name ILIKE :query ESCAPE '\\'", { query: `%${safeQuery}%` })
      .orWhere("tenant.slug ILIKE :query ESCAPE '\\'", { query: `%${safeQuery}%` })
      .orWhere("tenant.domain ILIKE :query ESCAPE '\\'", { query: `%${safeQuery}%` })
      .getMany();
  }

  private getPlanLimits(plan: TenantPlan): { userLimit: number; storageLimit: number } {
    const byPlan: Record<TenantPlan, { userLimit: number; storageLimit: number }> = {
      [TenantPlan.FREE]: TENANT_PLAN_LIMITS.FREE,
      [TenantPlan.BASIC]: TENANT_PLAN_LIMITS.BASIC,
      [TenantPlan.PROFESSIONAL]: TENANT_PLAN_LIMITS.PROFESSIONAL,
      [TenantPlan.ENTERPRISE]: TENANT_PLAN_LIMITS.ENTERPRISE,
    };
    return byPlan[plan] ?? TENANT_PLAN_LIMITS.FREE;
  }
}
