import { Injectable, Scope, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';

/**
 * IsolationService manages tenant context and data isolation
 * This service is request-scoped to maintain tenant context per request
 */
@Injectable({ scope: Scope.REQUEST })
export class IsolationService {
  private currentTenantId: string | null = null;
  private currentTenant: Tenant | null = null;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  /**
   * Set the current tenant context
   */
  async setTenant(tenantId: string): Promise<void> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }
    this.currentTenantId = tenantId;
    this.currentTenant = tenant;
  }

  /**
   * Set tenant by slug
   */
  async setTenantBySlug(slug: string): Promise<void> {
    const tenant = await this.tenantRepository.findOne({ where: { slug } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with slug ${slug} not found`);
    }
    this.currentTenantId = tenant.id;
    this.currentTenant = tenant;
  }

  /**
   * Set tenant by domain
   */
  async setTenantByDomain(domain: string): Promise<void> {
    const tenant = await this.tenantRepository.findOne({ where: { domain } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with domain ${domain} not found`);
    }
    this.currentTenantId = tenant.id;
    this.currentTenant = tenant;
  }

  /**
   * Get the current tenant ID
   */
  getTenantId(): string | null {
    return this.currentTenantId;
  }

  /**
   * Get the current tenant
   */
  getTenant(): Tenant | null {
    return this.currentTenant;
  }

  /**
   * Check if tenant context is set
   */
  hasTenantContext(): boolean {
    return this.currentTenantId !== null;
  }

  /**
   * Clear tenant context
   */
  clearTenant(): void {
    this.currentTenantId = null;
    this.currentTenant = null;
  }

  /**
   * Ensure tenant context is set, throw error if not
   */
  ensureTenantContext(): void {
    if (!this.hasTenantContext()) {
      throw new Error('Tenant context is not set');
    }
  }

  /**
   * Add tenant filter to query builder
   */
  applyTenantFilter<T>(queryBuilder: any, entityAlias: string): any {
    if (!this.currentTenantId) {
      throw new Error('Cannot apply tenant filter without tenant context');
    }
    return queryBuilder.andWhere(`${entityAlias}.tenantId = :tenantId`, {
      tenantId: this.currentTenantId,
    });
  }

  /**
   * Check if tenant is active
   */
  isActiveTenant(): boolean {
    return this.currentTenant?.status === 'active';
  }

  /**
   * Check if tenant is in trial
   */
  isTrialTenant(): boolean {
    return this.currentTenant?.status === 'trial';
  }

  /**
   * Check if tenant has reached user limit
   */
  hasReachedUserLimit(): boolean {
    if (!this.currentTenant) return false;
    return this.currentTenant.currentUserCount >= this.currentTenant.userLimit;
  }

  /**
   * Check if tenant has reached storage limit
   */
  hasReachedStorageLimit(): boolean {
    if (!this.currentTenant) return false;
    return this.currentTenant.currentStorageUsage >= this.currentTenant.storageLimit;
  }

  /**
   * Get tenant feature flags
   */
  async getTenantFeatures(): Promise<Record<string, any>> {
    if (!this.currentTenant) {
      return {};
    }
    // This would typically fetch from TenantConfig
    return this.currentTenant.metadata?.features || {};
  }
}
