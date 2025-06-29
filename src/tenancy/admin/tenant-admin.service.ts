import { Injectable } from '@nestjs/common';

@Injectable()
export class TenantAdminService {
  private admins: Record<string, string[]> = {};

  addAdmin(tenantId: string, adminId: string) {
    if (!this.admins[tenantId]) {
      this.admins[tenantId] = [];
    }
    this.admins[tenantId].push(adminId);
  }

  getAdmins(tenantId: string): string[] {
    return this.admins[tenantId] || [];
  }
}
