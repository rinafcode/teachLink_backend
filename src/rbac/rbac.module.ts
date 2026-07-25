import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { PermissionsController } from './permissions/permissions.controller';
import { PermissionsService } from './permissions/permissions.service';
import { RolesController } from './roles/roles.controller';
import { RolesService } from './roles/roles.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { IpAllowlistGuard } from '../common/guards/ip-allowlist.guard';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Permission, Role]), AuditLogModule],
  controllers: [PermissionsController, RolesController],
  providers: [PermissionsService, RolesService, IpAllowlistGuard],
  exports: [TypeOrmModule, RolesService, PermissionsService],
})
export class RbacModule {}
