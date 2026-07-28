import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { PermissionsController } from './permissions/permissions.controller';
import { PermissionsService } from './permissions/permissions.service';
import { RolesController } from './roles/roles.controller';
import { RolesService } from './roles/roles.service';

/**
 * RBAC module for role catalogue and role lifecycle management.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Permission, Role]), AuditLogModule],
  controllers: [PermissionsController, RolesController],
  providers: [PermissionsService, RolesService],
  exports: [TypeOrmModule, RolesService, PermissionsService],
})
export class RbacModule {}
