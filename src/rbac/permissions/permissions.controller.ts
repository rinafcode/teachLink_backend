import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { Permission } from '../entities/permission.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PaginatedSwaggerDto } from '../../common/dto/paginated-response.dto';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new permission (Admin only)' })
  @ApiResponse({ status: 201, description: 'Permission created', type: Permission })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async create(@Body() dto: CreatePermissionDto): Promise<Permission> {
    return this.permissionsService.createPermission(dto.resource, dto.action, dto.description);
  }

  @Get()
  @ApiOperation({ summary: 'Get all permissions with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated permissions',
    type: PaginatedSwaggerDto(Permission),
  })
  async findAll(@Query() query?: PaginationQueryDto) {
    return this.permissionsService.findAllPermissions(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get permission by ID' })
  @ApiResponse({ status: 200, description: 'Permission found', type: Permission })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  async findOne(@Param('id') id: string): Promise<Permission> {
    return this.permissionsService.findPermissionById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a permission (Admin only)' })
  @ApiResponse({ status: 200, description: 'Permission updated', type: Permission })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
  ): Promise<Permission> {
    return this.permissionsService.updatePermission(
      id,
      dto.resource,
      dto.action,
      dto.description,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a permission (Admin only)' })
  @ApiResponse({ status: 204, description: 'Permission deleted' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  @ApiResponse({ status: 409, description: 'Permission is still attached to one or more roles' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.permissionsService.deletePermission(id);
  }
}
