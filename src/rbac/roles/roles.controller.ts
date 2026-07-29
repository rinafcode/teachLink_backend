import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { Role } from '../entities/role.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PaginatedSwaggerDto } from '../../common/dto/paginated-response.dto';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  async create(
    @Body('name') name: string,
    @Body('description') description?: string,
    @Body('permissionIds') permissionIds?: string[],
  ): Promise<Role> {
    return this.rolesService.createRole(name, description, permissionIds);
  }

  @Get()
  @ApiOperation({ summary: 'Get all roles with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated roles',
    type: PaginatedSwaggerDto(Role),
  })
  async findAll(
    @Query() query?: PaginationQueryDto,
    @Query('include') include?: string,
  ) {
    const includePermissions = include === 'permissions';
    return this.rolesService.findAllRoles(query, includePermissions);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Role> {
    return this.rolesService.findRoleById(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body('name') name: string,
    @Body('description') description?: string,
    @Body('permissionIds') permissionIds?: string[],
  ): Promise<Role> {
    return this.rolesService.updateRole(id, name, description, permissionIds);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.rolesService.deleteRole(id);
  }

  @Post(':roleId/permissions/:permissionId')
  async addPermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ): Promise<Role> {
    return this.rolesService.addPermissionToRole(roleId, permissionId);
  }

  @Delete(':roleId/permissions/:permissionId')
  async removePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ): Promise<Role> {
    return this.rolesService.removePermissionFromRole(roleId, permissionId);
  }
}
