import { Injectable } from '@nestjs/common';

@Injectable()
export class TenantBillingService {
  private usage: Record<string, number> = {};

  trackUsage(tenantId: string, amount: number) {
    this.usage[tenantId] = (this.usage[tenantId] || 0) + amount;
  }

  getUsage(tenantId: string): number {
    return this.usage[tenantId] || 0;
  }

  generateInvoice(tenantId: string) {
    // Simulate invoice generation
    return {
      tenantId,
      usage: this.getUsage(tenantId),
      amountDue: this.getUsage(tenantId) * 10, // Example rate
    };
  }
}
