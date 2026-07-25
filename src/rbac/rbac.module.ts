import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { User } from '../users/entities/user.entity';
import { Role } from './entities/role.entity';
import { RolesService } from './roles/roles.service';

/**
 * RBAC module for role catalogue and role lifecycle management.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Role, User]), AuditLogModule],
  providers: [RolesService],
  exports: [RolesService],
})
export class RbacModule {}
