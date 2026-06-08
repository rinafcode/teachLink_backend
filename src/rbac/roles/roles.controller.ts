import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { RolesService } from './roles.service';
import { Role } from '../entities/role.entity';

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
  async findAll(): Promise<Role[]> {
    return this.rolesService.findAllRoles();
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