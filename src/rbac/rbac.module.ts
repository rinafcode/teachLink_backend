import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RedisModule } from '../common/redis/redis.module';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { PermissionsController } from './permissions/permissions.controller';
import { PermissionsService } from './permissions/permissions.service';
import { RolesController } from './roles/roles.controller';
import { RolesService } from './roles/roles.service';
import { RbacCacheService } from './rbac-cache.service';
import { IpAllowlistGuard } from '../common/guards/ip-allowlist.guard';

/**
 * RBAC module for role catalogue and role lifecycle management.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Permission, Role]),
    AuditLogModule,
    RedisModule.forRoot(),
  ],
  controllers: [PermissionsController, RolesController],
  providers: [PermissionsService, RolesService, RbacCacheService, IpAllowlistGuard],
  exports: [TypeOrmModule, RolesService, PermissionsService, RbacCacheService],
})
export class RbacModule {}
