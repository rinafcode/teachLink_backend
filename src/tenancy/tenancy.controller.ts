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
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
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
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TenantPlan } from './entities/tenant.entity';

/**
 * Exposes tenancy endpoints.
 */
@ApiTags('tenancy')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenancyController {
  constructor(
    private readonly tenancyService: TenancyService,
    private readonly adminService: TenantAdminService,
    private readonly billingService: TenantBillingService,
    private readonly customizationService: CustomizationService,
  ) {}

  /**
   * Creates a new record.
   * @param createTenantDto The request payload.
   * @returns The operation result.
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new tenant (Admin only)' })
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenancyService.create(createTenantDto);
  }

  /**
   * Returns all.
   * @param page The page number.
   * @param limit The maximum number of results.
   * @returns The operation result.
   */
  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all tenants (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.tenancyService.findAll(page, limit);
  }

  /**
   * Returns search.
   * @param query The query value.
   * @returns The operation result.
   */
  @Get('search')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Search tenants (Admin only)' })
  @ApiQuery({ name: 'q', required: true })
  search(@Query('q') query: string) {
    return this.adminService.searchTenants(query);
  }

  /**
   * Returns one.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  findOne(@Param('id') id: string) {
    return this.tenancyService.findOne(id);
  }

  /**
   * Returns tenant With Relations.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id/full')
  @ApiOperation({ summary: 'Get tenant with all related data' })
  getTenantWithRelations(@Param('id') id: string) {
    return this.tenancyService.getTenantWithRelations(id);
  }

  /**
   * Returns statistics.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get tenant statistics' })
  getStatistics(@Param('id') id: string) {
    return this.adminService.getTenantStatistics(id);
  }

  /**
   * Validates health.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id/health')
  @ApiOperation({ summary: 'Check tenant health' })
  checkHealth(@Param('id') id: string) {
    return this.adminService.checkTenantHealth(id);
  }

  /**
   * Updates the requested record.
   * @param id The identifier.
   * @param updateTenantDto The request payload.
   * @returns The operation result.
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update tenant (Admin only)' })
  update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenancyService.update(id, updateTenantDto);
  }

  /**
   * Removes the requested record.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete tenant (Admin only)' })
  remove(@Param('id') id: string) {
    return this.tenancyService.remove(id);
  }

  // Configuration endpoints
  /**
   * Returns config.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id/config')
  @ApiOperation({ summary: 'Get tenant configuration' })
  getConfig(@Param('id') id: string) {
    return this.tenancyService.getConfig(id);
  }

  /**
   * Updates config.
   * @param id The identifier.
   * @param updateConfigDto The request payload.
   * @returns The operation result.
   */
  @Patch(':id/config')
  @ApiOperation({ summary: 'Update tenant configuration' })
  updateConfig(@Param('id') id: string, @Body() updateConfigDto: UpdateTenantConfigDto) {
    return this.tenancyService.updateConfig(id, updateConfigDto);
  }

  // Billing endpoints
  /**
   * Returns billing.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id/billing')
  @ApiOperation({ summary: 'Get tenant billing information' })
  getBilling(@Param('id') id: string) {
    return this.billingService.getBillingInfo(id);
  }

  /**
   * Returns billing History.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id/billing/history')
  @ApiOperation({ summary: 'Get tenant billing history' })
  getBillingHistory(@Param('id') id: string) {
    return this.billingService.getBillingHistory(id);
  }

  /**
   * Generates invoice.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Post(':id/billing/invoice')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate invoice for tenant (Admin only)' })
  generateInvoice(@Param('id') id: string) {
    return this.billingService.generateInvoice(id);
  }

  // Customization endpoints
  /**
   * Returns customization.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id/customization')
  @ApiOperation({ summary: 'Get tenant customization' })
  getCustomization(@Param('id') id: string) {
    return this.customizationService.getCustomization(id);
  }

  /**
   * Updates customization.
   * @param id The identifier.
   * @param updateCustomizationDto The request payload.
   * @returns The operation result.
   */
  @Patch(':id/customization')
  @ApiOperation({ summary: 'Update tenant customization' })
  updateCustomization(
    @Param('id') id: string,
    @Body() updateCustomizationDto: UpdateTenantCustomizationDto,
  ) {
    return this.customizationService.updateCustomization(id, updateCustomizationDto);
  }

  // Admin operations
  /**
   * Executes suspend.
   * @param id The identifier.
   * @param reason The reason.
   * @returns The operation result.
   */
  @Post(':id/suspend')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Suspend tenant (Admin only)' })
  suspend(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.adminService.suspendTenant(id, reason);
  }

  /**
   * Executes activate.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Post(':id/activate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate tenant (Admin only)' })
  activate(@Param('id') id: string) {
    return this.adminService.activateTenant(id);
  }

  /**
   * Executes upgrade Plan.
   * @param id The identifier.
   * @param plan The plan.
   * @returns The operation result.
   */
  @Post(':id/upgrade')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Upgrade tenant plan (Admin only)' })
  upgradePlan(@Param('id') id: string, @Body('plan') plan: TenantPlan) {
    return this.adminService.upgradePlan(id, plan);
  }

  /**
   * Resets data.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Post(':id/reset-data')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reset tenant data (Admin only)' })
  resetData(@Param('id') id: string) {
    return this.adminService.resetTenantData(id);
  }

  /**
   * Exports data.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id/export')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Export tenant data (Admin only)' })
  exportData(@Param('id') id: string) {
    return this.adminService.exportTenantData(id);
  }
}
