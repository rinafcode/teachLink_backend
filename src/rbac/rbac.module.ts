import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { PermissionsController } from './permissions/permissions.controller';
import { PermissionsService } from './permissions/permissions.service';
import { RolesController } from './roles/roles.controller';
import { RolesService } from './roles/roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Permission, Role])],
  controllers: [PermissionsController, RolesController],
  providers: [PermissionsService, RolesService],
  exports: [TypeOrmModule],
})
export class RbacModule {}