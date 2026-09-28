import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { Role } from '../entities/role.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { IpAllowlistGuard } from '../../common/guards/ip-allowlist.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PaginatedSwaggerDto } from '../../common/dto/paginated-response.dto';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(IpAllowlistGuard, JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Authentication required' })
@ApiResponse({ status: 403, description: 'Admin role or allowlisted IP required' })
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  private extractContext(req: Request) {
    const user: any = req.user || {};
    return {
      actorId: user.id || user.sub,
      actorEmail: user.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new role (Admin only)' })
  @ApiResponse({ status: 201, description: 'Role successfully created', type: Role })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Role with this name already exists' })
  async create(@Body() createRoleDto: CreateRoleDto, @Req() req: Request): Promise<Role> {
    return this.rolesService.createRole(
      createRoleDto.name,
      createRoleDto.description,
      createRoleDto.permissionIds,
      this.extractContext(req),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all roles with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated roles',
    type: PaginatedSwaggerDto(Role),
  })
  async findAll(@Query() query?: PaginationQueryDto, @Query('include') include?: string) {
    const includePermissions = include === 'permissions';
    return this.rolesService.findAllRoles(query, includePermissions);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get role by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Role found', type: Role })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async findOne(@Param('id') id: string): Promise<Role> {
    return this.rolesService.findRoleById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a role (Admin only)' })
  @ApiResponse({ status: 200, description: 'Role successfully updated', type: Role })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 409, description: 'Role with this name already exists' })
  async update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Req() req: Request,
  ): Promise<Role> {
    return this.rolesService.updateRole(
      id,
      updateRoleDto.name,
      updateRoleDto.description,
      updateRoleDto.permissionIds,
      this.extractContext(req),
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a role (Admin only)' })
  @ApiResponse({ status: 200, description: 'Role successfully deleted' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 409, description: 'Role is in use and cannot be deleted' })
  async remove(@Param('id') id: string, @Req() req: Request): Promise<void> {
    return this.rolesService.deleteRole(id, this.extractContext(req));
  }

  @Post(':roleId/permissions/:permissionId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Add permission to role (Admin only)' })
  @ApiResponse({ status: 200, description: 'Permission successfully added to role', type: Role })
  @ApiResponse({ status: 404, description: 'Role or permission not found' })
  @ApiResponse({ status: 409, description: 'Permission already assigned to role' })
  async addPermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: Request,
  ): Promise<Role> {
    return this.rolesService.addPermissionToRole(roleId, permissionId, this.extractContext(req));
  }

  @Delete(':roleId/permissions/:permissionId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove permission from role (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Permission successfully removed from role',
    type: Role,
  })
  @ApiResponse({ status: 404, description: 'Role or permission not found' })
  @ApiResponse({ status: 400, description: 'Permission is not assigned to this role' })
  async removePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: Request,
  ): Promise<Role> {
    return this.rolesService.removePermissionFromRole(
      roleId,
      permissionId,
      this.extractContext(req),
    );
  }
}
