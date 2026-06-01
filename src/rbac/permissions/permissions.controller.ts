import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { Permission } from '../entities/permission.entity';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  async create(
    @Body('resource') resource: string,
    @Body('action') action: string,
    @Body('description') description?: string,
  ): Promise<Permission> {
    return this.permissionsService.createPermission(resource, action, description);
  }

  @Get()
  async findAll(): Promise<Permission[]> {
    return this.permissionsService.findAllPermissions();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Permission> {
    return this.permissionsService.findPermissionById(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body('resource') resource: string,
    @Body('action') action: string,
    @Body('description') description?: string,
  ): Promise<Permission> {
    return this.permissionsService.updatePermission(id, resource, action, description);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.permissionsService.deletePermission(id);
  }
}