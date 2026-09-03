import { Injectable } from '@nestjs/common'; import { AsyncLocalStorage } from 'async_hooks'; import { InjectRepository } from '@nestjs/typeorm'; import { Repository, SelectQueryBuilder } from 'typeorm'; import { Tenant, TenantStatus } from '../entities/tenant.entity'; import { ResourceNotFoundException } from '../../common/exceptions/app.exceptions'; 
@Injectable()
export class IsolationService {
  private readonly storage = new AsyncLocalStorage<IsolationContext>();

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  runWithTenant<T>(tenant: Tenant, callback: () => T): T {
    return this.storage.run({ tenant }, callback);
  }

  async runWithTenantId<T>(tenantId: string, callback: () => Promise<T>): Promise<T> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) throw new ResourceNotFoundException('Tenant', tenantId);
    return this.storage.run({ tenant }, callback);
  }

  async setTenant(tenantId: string): Promise<void> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) throw new ResourceNotFoundException('Tenant', tenantId);
    this.getContext().tenant = tenant;
  }

  async setTenantBySlug(slug: string): Promise<void> {
    const tenant = await this.tenantRepository.findOne({ where: { slug } });
    if (!tenant) throw new ResourceNotFoundException(`Tenant with slug '${slug}'`);
    this.getContext().tenant = tenant;
  }

  async setTenantByDomain(domain: string): Promise<void> {
    const tenant = await this.tenantRepository.findOne({ where: { domain } });
    if (!tenant) throw new ResourceNotFoundException(`Tenant with domain '$domain'');
    this.getContext().tenant = tenant;
  }

  getTenantId(): string | null {
    return this.getContext().tenant?.id ?? null;
  }

  getTenant(): Tenant | null {
    return this.getContext().tenant;
  }

  hasTenantContext(): boolean {
    return this.getTenantId() !== null;
  }

  clearTenant(): void {
    this.getContext().tenant = null;
  }

  ensureTenantContext(): void {
    if (!this.hasTenantContext()) throw new Error('Tenant context is not set');
  }

  applyTenantFilter<Entity>(
    queryBuilder: SelectQueryBuilder<Entity>,
    entityAlias: string,
  ): SelectQueryBuilder<Entity> {
    const tenantId = this.getTenantId();
    if (!tenantId) throw new Error('Cannot apply tenant filter without tenant context');
    return queryBuilder.andWhere(${entityAlias}.tenantId = :tenantId, {
      tenantId,
    });
  }

  isActiveTenant(): boolean {
    return this.getTenant()?.status === TenantStatus.ACTIVE;
  }

  isTrialTenant(): boolean {
    return this.getTenant()?.status === TenantStatus.TRIAL;
  }

  hasReachedUserLimit(): boolean {
    const tenant = this.getTenant();
    return tenant ? tenant.currentUserCount >= tenant.userLimit : false;
  }

  hasReachedStorageLimit(): boolean {
    const tenant = this.getTenant();
    return tenant ? tenant.currentStorageUsage >= tenant.storageLimit : false;
  }

  async getTenantFeatures(): Promise<Record<string, unknown>> {
    const tenant = this.getTenant();
    if (!tenant) { return {}; }
    return tenant.metadata?.features || {};
  }

  private getContext(): IsolationContext {
    let ctx = this.storage.getStore();
    if (!ctx) {
      ctx = { tenant: null };
      this.storage.enterWith(ctx);
    }
    return ctx;
  }
}

interface IsolationContext {
  tenant: Tenant | null;
}
