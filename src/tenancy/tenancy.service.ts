import { Injectable } from '@nestjs/common';
import {
  ResourceNotFoundException,
  ResourceConflictException,
  BusinessValidationException,
} from '../common/exceptions/app.exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantConfig } from './entities/tenant-config.entity';
import { TenantBilling } from './entities/tenant-billing.entity';
import { TenantCustomization } from './entities/tenant-customization.entity';
import { CreateTenantDto, UpdateTenantDto, UpdateTenantConfigDto } from './dto/tenant.dto';
import { TenantBillingService } from './billing/tenant-billing.service';
import { CustomizationService } from './customization/customization.service';
import { TENANT_DEFAULTS } from './tenancy.constants';
import { OffsetPaginatedResponse } from '../common/interfaces/pagination.interface';
import { buildOffsetResponse } from '../common/utils/pagination.utils';

/**
 * Provides tenancy operations.
 */
@Injectable()
export class TenancyService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(TenantConfig)
    private readonly configRepository: Repository<TenantConfig>,
    @InjectRepository(TenantBilling)
    private readonly billingRepository: Repository<TenantBilling>,
    @InjectRepository(TenantCustomization)
    private readonly customizationRepository: Repository<TenantCustomization>,
    private readonly billingService: TenantBillingService,
    private readonly customizationService: CustomizationService,
  ) {}

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    const existingTenant = await this.tenantRepository.findOne({
      where: { slug: createTenantDto.slug },
      withDeleted: true,
    });
    if (existingTenant) {
      throw new ResourceConflictException('Tenant', 'slug');
    }

    const tenant = this.tenantRepository.create({
      ...createTenantDto,
      userLimit: createTenantDto.userLimit ?? TENANT_DEFAULTS.USER_LIMIT,
      storageLimit: createTenantDto.storageLimit ?? TENANT_DEFAULTS.STORAGE_LIMIT_MB,
    });

    const savedTenant = await this.tenantRepository.save(tenant);

    await Promise.all([
      this.createDefaultConfig(savedTenant.id),
      this.billingService.createBillingRecord(savedTenant.id),
      this.customizationService.createDefaultCustomization(savedTenant.id),
    ]);

    return savedTenant;
  }

  async findAll(
    page: number = 1,
    limit: number = TENANT_DEFAULTS.DEFAULT_PAGE_SIZE,
  ): Promise<OffsetPaginatedResponse<Tenant>> {
    const [tenants, total] = await this.tenantRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return buildOffsetResponse(tenants, total, page, limit);
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new ResourceNotFoundException('Tenant', id);
    }
    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { slug } });
    if (!tenant) {
      throw new ResourceNotFoundException(`Tenant with slug '${slug}'`);
    }
    return tenant;
  }

  async findByDomain(domain: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { domain } });
    if (!tenant) {
      throw new ResourceNotFoundException(`Tenant with domain '${domain}'`);
    }
    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);
    Object.assign(tenant, updateTenantDto);
    return await this.tenantRepository.save(tenant);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.tenantRepository.manager.transaction(async (manager) => {
      await manager.getRepository(TenantConfig).softDelete({ tenantId: id });
      await manager.getRepository(TenantBilling).softDelete({ tenantId: id });
      await manager.getRepository(TenantCustomization).softDelete({ tenantId: id });
      await manager.getRepository(Tenant).softDelete(id);
    });
  }

  async getConfig(tenantId: string): Promise<TenantConfig> {
    const config = await this.configRepository.findOne({ where: { tenantId } });
    if (!config) {
      throw new ResourceNotFoundException(`TenantConfig for tenant '${tenantId}'`);
    }
    return config;
  }

  async updateConfig(
    tenantId: string,
    updateConfigDto: UpdateTenantConfigDto,
  ): Promise<TenantConfig> {
    const config = await this.getConfig(tenantId);
    Object.assign(config, updateConfigDto);
    return await this.configRepository.save(config);
  }

  private async createDefaultConfig(tenantId: string): Promise<TenantConfig> {
    const config = this.configRepository.create({
      tenantId,
      features: {
        analytics: true,
        messaging: true,
        courses: true,
        assessments: true,
        recommendations: true,
      },
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      security: {
        mfaRequired: false,
        passwordPolicy: {
          minLength: 8,
          requireNumbers: true,
          requireSpecialChars: true,
          requireUppercase: true,
        },
        sessionTimeout: TENANT_DEFAULTS.SESSION_TIMEOUT_SECONDS,
      },
    });

    return await this.configRepository.save(config);
  }

  async incrementUserCount(tenantId: string): Promise<void> {
    await this.tenantRepository.increment({ id: tenantId }, 'currentUserCount', 1);
  }

  async decrementUserCount(tenantId: string): Promise<void> {
    await this.tenantRepository.decrement({ id: tenantId }, 'currentUserCount', 1);
  }

  async updateStorageUsage(tenantId: string, sizeInMB: number): Promise<void> {
    const tenant = await this.findOne(tenantId);
    tenant.currentStorageUsage += sizeInMB;
    await this.tenantRepository.save(tenant);
  }

  async getTenantWithRelations(tenantId: string): Promise<{
    tenant: Tenant;
    config: TenantConfig;
    billing: TenantBilling;
    customization: TenantCustomization;
  }> {
    const [tenant, config, billing, customization] = await Promise.all([
      this.findOne(tenantId),
      this.getConfig(tenantId),
      this.billingService.getBillingInfo(tenantId),
      this.customizationService.getCustomization(tenantId),
    ]);

    return {
      tenant,
      config,
      billing,
      customization,
    };
  }

  /**
   * Resolves tenant id from headers, authenticated user, middleware-populated req.tenant, or domain.
   * Order matches TenantMiddleware resolution.
   */
  async resolveTenantIdFromRequest(req: {
    headers?: Record<string, unknown>;
    hostname?: string;
    user?: { tenantId?: string };
    tenant?: { id?: string };
  }): Promise<string> {
    const headerId = req.headers?.['x-tenant-id'] as string | undefined;
    if (headerId) return headerId;

    const slug = req.headers?.['x-tenant-slug'] as string | undefined;
    if (slug) {
      const tenant = await this.tenantRepository.findOne({ where: { slug } });
      if (tenant) return tenant.id;
    }

    const userTenantId = req.user?.tenantId;
    if (userTenantId) return userTenantId;

    if (req.tenant?.id) return req.tenant.id;

    const domain = (req.headers?.['x-tenant-domain'] as string | undefined) || req.hostname;
    if (domain) {
      const tenant = await this.tenantRepository.findOne({ where: { domain } });
      if (tenant) return tenant.id;
    }

    throw new BusinessValidationException('Tenant context could not be resolved from the request');
  }

  async validateTenantExists(tenantId: string): Promise<void> {
    await this.findOne(tenantId);
  }
}
