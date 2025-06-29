import { Module } from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { IsolationService } from './isolation/isolation.service';
import { TenantBillingService } from './billing/tenant-billing.service';
import { CustomizationService } from './customization/customization.service';
import { TenantAdminService } from './admin/tenant-admin.service';

@Module({
  providers: [
    TenancyService,
    IsolationService,
    TenantBillingService,
    CustomizationService,
    TenantAdminService,
  ],
  exports: [
    TenancyService,
    IsolationService,
    TenantBillingService,
    CustomizationService,
    TenantAdminService,
  ],
})
export class TenancyModule {}
