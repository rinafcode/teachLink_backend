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
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { Role } from '../entities/role.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('roles')
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
  async create(
    @Body() createRoleDto: CreateRoleDto,
    @Req() req: Request,
  ): Promise<Role> {
    return this.rolesService.createRole(
      createRoleDto.name,
      createRoleDto.description,
      createRoleDto.permissionIds,
      this.extractContext(req),
    );
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
  async remove(@Param('id') id: string, @Req() req: Request): Promise<void> {
    return this.rolesService.deleteRole(id, this.extractContext(req));
  }

  @Post(':roleId/permissions/:permissionId')
  async addPermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Req() req: Request,
  ): Promise<Role> {
    return this.rolesService.addPermissionToRole(
      roleId,
      permissionId,
      this.extractContext(req),
    );
  }

  @Delete(':roleId/permissions/:permissionId')
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
