import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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

  /**
   * Create a new tenant
   */
  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Check if slug already exists
    const existingTenant = await this.tenantRepository.findOne({
      where: { slug: createTenantDto.slug },
      withDeleted: true,
    });

    if (existingTenant) {
      throw new ConflictException('Tenant with this slug already exists');
    }

    // Create tenant
    const tenant = this.tenantRepository.create({
      ...createTenantDto,
      userLimit: createTenantDto.userLimit || TENANT_DEFAULTS.USER_LIMIT,
      storageLimit: createTenantDto.storageLimit || TENANT_DEFAULTS.STORAGE_LIMIT_MB,
    });

    const savedTenant = await this.tenantRepository.save(tenant);

    // Create related records
    await Promise.all([
      this.createDefaultConfig(savedTenant.id),
      this.billingService.createBillingRecord(savedTenant.id),
      this.customizationService.createDefaultCustomization(savedTenant.id),
    ]);

    return savedTenant;
  }

  /**
   * Find all tenants
   */
  async findAll(
    page: number = 1,
    limit: number = TENANT_DEFAULTS.DEFAULT_PAGE_SIZE,
  ): Promise<{ tenants: Tenant[]; total: number; page: number; totalPages: number }> {
    const [tenants, total] = await this.tenantRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      tenants,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find tenant by ID
   */
  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }
    return tenant;
  }

  /**
   * Find tenant by slug
   */
  async findBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { slug } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with slug ${slug} not found`);
    }
    return tenant;
  }

  /**
   * Find tenant by domain
   */
  async findByDomain(domain: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { domain } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with domain ${domain} not found`);
    }
    return tenant;
  }

  /**
   * Update tenant
   */
  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);

    Object.assign(tenant, updateTenantDto);

    return await this.tenantRepository.save(tenant);
  }

  /**
   * Delete tenant
   */
  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.tenantRepository.manager.transaction(async (manager) => {
      await manager.getRepository(TenantConfig).softDelete({ tenantId: id });
      await manager.getRepository(TenantBilling).softDelete({ tenantId: id });
      await manager.getRepository(TenantCustomization).softDelete({ tenantId: id });
      await manager.getRepository(Tenant).softDelete(id);
    });
  }

  /**
   * Get tenant configuration
   */
  async getConfig(tenantId: string): Promise<TenantConfig> {
    const config = await this.configRepository.findOne({ where: { tenantId } });
    if (!config) {
      throw new NotFoundException(`Config not found for tenant ${tenantId}`);
    }
    return config;
  }

  /**
   * Update tenant configuration
   */
  async updateConfig(
    tenantId: string,
    updateConfigDto: UpdateTenantConfigDto,
  ): Promise<TenantConfig> {
    const config = await this.getConfig(tenantId);

    Object.assign(config, updateConfigDto);

    return await this.configRepository.save(config);
  }

  /**
   * Create default configuration
   */
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

  /**
   * Increment user count
   */
  async incrementUserCount(tenantId: string): Promise<void> {
    await this.tenantRepository.increment({ id: tenantId }, 'currentUserCount', 1);
  }

  /**
   * Decrement user count
   */
  async decrementUserCount(tenantId: string): Promise<void> {
    await this.tenantRepository.decrement({ id: tenantId }, 'currentUserCount', 1);
  }

  /**
   * Update storage usage
   */
  async updateStorageUsage(tenantId: string, sizeInMB: number): Promise<void> {
    const tenant = await this.findOne(tenantId);
    tenant.currentStorageUsage += sizeInMB;
    await this.tenantRepository.save(tenant);
  }

  /**
   * Get tenant with all related data
   */
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
}
