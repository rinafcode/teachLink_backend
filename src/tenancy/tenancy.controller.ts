import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { TenancyService } from './tenancy.service';
import { TenantAdminService } from './admin/tenant-admin.service';
import { TenantBillingService } from './billing/tenant-billing.service';
import { CustomizationService } from './customization/customization.service';
import {
  CreateTenantDto,
  UpdateTenantDto,
  UpdateTenantConfigDto,
  UpdateTenantCustomizationDto,
} from './dto/tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { IpAllowlistGuard } from '../common/guards/ip-allowlist.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { Tenant, TenantPlan } from './entities/tenant.entity';
import { PaginatedSwaggerDto } from '../common/dto/paginated-response.dto';

/**
 * Exposes tenancy endpoints.
 */
@ApiTags('tenancy')
@Controller('tenants')
@UseGuards(IpAllowlistGuard, JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Authentication required' })
@ApiResponse({ status: 403, description: 'Insufficient tenant permissions' })
export class TenancyController {
  constructor(
    private readonly tenancyService: TenancyService,
    private readonly adminService: TenantAdminService,
    private readonly billingService: TenantBillingService,
    private readonly customizationService: CustomizationService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new tenant (Admin only)' })
  @ApiResponse({ status: 201, description: 'Tenant created', type: Tenant })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenancyService.create(createTenantDto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all tenants (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of tenants',
    type: PaginatedSwaggerDto(Tenant),
  })
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.tenancyService.findAll(page, limit);
  }

  @Get('search')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Search tenants (Admin only)' })
  @ApiQuery({ name: 'q', required: true })
  @ApiResponse({ status: 200, description: 'Matching tenants', type: [Tenant] })
  search(@Query('q') query: string) {
    return this.adminService.searchTenants(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'The requested tenant', type: Tenant })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findOne(@Param('id') id: string) {
    return this.tenancyService.findOne(id);
  }

  @Get(':id/full')
  @ApiOperation({ summary: 'Get tenant with all related data' })
  @ApiResponse({ status: 200, description: 'Tenant with related entities', type: Tenant })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getTenantWithRelations(@Param('id') id: string) {
    return this.tenancyService.getTenantWithRelations(id);
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get tenant statistics' })
  @ApiResponse({ status: 200, description: 'Aggregated tenant statistics' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getStatistics(@Param('id') id: string) {
    return this.adminService.getTenantStatistics(id);
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Check tenant health' })
  @ApiResponse({ status: 200, description: 'Tenant health report' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  checkHealth(@Param('id') id: string) {
    return this.adminService.checkTenantHealth(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update tenant (Admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant updated', type: Tenant })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenancyService.update(id, updateTenantDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete tenant (Admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant deleted' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  remove(@Param('id') id: string) {
    return this.tenancyService.remove(id);
  }

  @Get(':id/config')
  @ApiOperation({ summary: 'Get tenant configuration' })
  @ApiResponse({ status: 200, description: 'Tenant configuration' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getConfig(@Param('id') id: string) {
    return this.tenancyService.getConfig(id);
  }

  @Patch(':id/config')
  @ApiOperation({ summary: 'Update tenant configuration' })
  @ApiResponse({ status: 200, description: 'Tenant configuration updated' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  updateConfig(@Param('id') id: string, @Body() updateConfigDto: UpdateTenantConfigDto) {
    return this.tenancyService.updateConfig(id, updateConfigDto);
  }

  @Get(':id/billing')
  @ApiOperation({ summary: 'Get tenant billing information' })
  @ApiResponse({ status: 200, description: 'Tenant billing information' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getBilling(@Param('id') id: string) {
    return this.billingService.getBillingInfo(id);
  }

  @Get(':id/billing/history')
  @ApiOperation({ summary: 'Get tenant billing history' })
  @ApiResponse({ status: 200, description: 'Tenant billing history' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getBillingHistory(@Param('id') id: string) {
    return this.billingService.getBillingHistory(id);
  }

  @Post(':id/billing/invoice')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate invoice for tenant (Admin only)' })
  @ApiResponse({ status: 201, description: 'Invoice generated' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  generateInvoice(@Param('id') id: string) {
    return this.billingService.generateInvoice(id);
  }

  @Get(':id/customization')
  @ApiOperation({ summary: 'Get tenant customization' })
  @ApiResponse({ status: 200, description: 'Tenant customization' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getCustomization(@Param('id') id: string) {
    return this.customizationService.getCustomization(id);
  }

  @Patch(':id/customization')
  @ApiOperation({ summary: 'Update tenant customization' })
  @ApiResponse({ status: 200, description: 'Tenant customization updated' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  updateCustomization(
    @Param('id') id: string,
    @Body() updateCustomizationDto: UpdateTenantCustomizationDto,
  ) {
    return this.customizationService.updateCustomization(id, updateCustomizationDto);
  }

  @Post(':id/suspend')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Suspend tenant (Admin only)' })
  @ApiResponse({ status: 201, description: 'Tenant suspended' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  suspend(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.adminService.suspendTenant(id, reason);
  }

  @Post(':id/activate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate tenant (Admin only)' })
  @ApiResponse({ status: 201, description: 'Tenant activated' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  activate(@Param('id') id: string) {
    return this.adminService.activateTenant(id);
  }

  @Post(':id/upgrade')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Upgrade tenant plan (Admin only)' })
  @ApiResponse({ status: 201, description: 'Tenant plan upgraded' })
  @ApiResponse({ status: 400, description: 'Invalid plan' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  upgradePlan(@Param('id') id: string, @Body('plan') plan: TenantPlan) {
    return this.adminService.upgradePlan(id, plan);
  }

  @Post(':id/reset-data')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reset tenant data (Admin only)' })
  @ApiResponse({ status: 201, description: 'Tenant data reset' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  resetData(@Param('id') id: string) {
    return this.adminService.resetTenantData(id);
  }

  @Get(':id/export')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Export tenant data (Admin only)' })
  @ApiResponse({ status: 200, description: 'Exported tenant data' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  exportData(@Param('id') id: string) {
    return this.adminService.exportTenantData(id);
  }
}
