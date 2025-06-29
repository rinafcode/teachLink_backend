import { Injectable } from '@nestjs/common';

@Injectable()
export class CustomizationService {
  private branding: Record<string, any> = {};

  setBranding(tenantId: string, branding: Record<string, any>) {
    this.branding[tenantId] = branding;
  }

  getBranding(tenantId: string) {
    return this.branding[tenantId] || {};
  }
}
