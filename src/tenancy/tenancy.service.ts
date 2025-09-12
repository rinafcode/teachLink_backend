import { Injectable } from '@nestjs/common';

export interface Tenant {
  id: string;
  name: string;
  config: Record<string, any>;
  branding: Record<string, any>;
}

@Injectable()
export class TenancyService {
  private tenants: Tenant[] = [];

  createTenant(tenant: Tenant) {
    this.tenants.push(tenant);
    return tenant;
  }

  getTenantById(id: string): Tenant | undefined {
    return this.tenants.find((t) => t.id === id);
  }

  listTenants(): Tenant[] {
    return this.tenants;
  }

  updateTenant(id: string, update: Partial<Tenant>) {
    const tenant = this.getTenantById(id);
    if (tenant) {
      Object.assign(tenant, update);
    }
    return tenant;
  }
}
