import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { Permission } from '../entities/permission.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PaginatedSwaggerDto } from '../../common/dto/paginated-response.dto';

@ApiTags('permissions')
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
