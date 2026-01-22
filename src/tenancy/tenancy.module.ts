import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyService } from './tenancy.service';
import { TenancyController } from './tenancy.controller';
import { Tenant } from './entities/tenant.entity';
import { TenantConfig } from './entities/tenant-config.entity';
import { TenantBilling } from './entities/tenant-billing.entity';
import { TenantCustomization } from './entities/tenant-customization.entity';
import { IsolationService } from './isolation/isolation.service';
import { TenantBillingService } from './billing/tenant-billing.service';
import { CustomizationService } from './customization/customization.service';
import { TenantAdminService } from './admin/tenant-admin.service';
import { TenantGuard } from './guards/tenant.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      TenantConfig,
      TenantBilling,
      TenantCustomization,
    ]),
  ],
  controllers: [TenancyController],
  providers: [
    TenancyService,
    IsolationService,
    TenantBillingService,
    CustomizationService,
    TenantAdminService,
    TenantGuard,
  ],
  exports: [
    TenancyService,
    IsolationService,
    TenantBillingService,
    CustomizationService,
    TenantAdminService,
    TenantGuard,
  ],
})
export class TenancyModule {}
