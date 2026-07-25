import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { User } from '../../users/entities/user.entity';
import { Role, BUILTIN_ROLE_NAMES } from '../entities/role.entity';

export interface RoleActor {
  id?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Provides role management operations.
 */
@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(includeDeleted = false): Promise<Role[]> {
    return this.roleRepository.find({
      withDeleted: includeDeleted,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, includeDeleted = false): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      withDeleted: includeDeleted,
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  async findByName(name: string, includeDeleted = false): Promise<Role | null> {
    return this.roleRepository.findOne({
      where: { name },
      withDeleted: includeDeleted,
    });
  }

  async isRoleActive(name: string): Promise<boolean> {
    const role = await this.roleRepository.findOne({
      where: { name },
      withDeleted: true,
    });

    if (!role) {
      return BUILTIN_ROLE_NAMES.includes(name as (typeof BUILTIN_ROLE_NAMES)[number]);
    }

    return role.deletedAt == null;
  }

  async deleteRole(id: string, actor?: RoleActor): Promise<Role> {
    const role = await this.findOne(id, true);

    if (role.isSystem || BUILTIN_ROLE_NAMES.includes(role.name as (typeof BUILTIN_ROLE_NAMES)[number])) {
      throw new ConflictException(`System role '${role.name}' cannot be deleted`);
    }

    const userCount = await this.userRepository.count({
      where: {
        role: role.name as User['role'],
        deletedAt: IsNull(),
      },
    });

    if (userCount > 0) {
      throw new ConflictException({
        message: `Role '${role.name}' is currently assigned to ${userCount} user(s)`,
        count: userCount,
        roleId: role.id,
      });
    }

    await this.roleRepository.softDelete(role.id);

    await this.auditLogService.log({
      userId: actor?.id,
      userEmail: actor?.email,
      action: AuditAction.DATA_DELETED,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.WARNING,
      entityType: 'Role',
      entityId: role.id,
      description: `Role '${role.name}' was soft-deleted`,
      metadata: {
        role: {
          id: role.id,
          name: role.name,
          isSystem: role.isSystem,
          permissions: role.permissions,
        },
        affectedAssignments: userCount,
        actor: actor
          ? {
              id: actor.id,
              email: actor.email,
              ipAddress: actor.ipAddress,
              userAgent: actor.userAgent,
            }
          : undefined,
      },
      oldValues: {
        deletedAt: role.deletedAt ?? null,
      },
      newValues: {
        deletedAt: new Date(),
      },
    });

    return this.findOne(role.id, true);
  }

  async restoreRole(id: string, actor?: RoleActor): Promise<Role> {
    const role = await this.findOne(id, true);

    await this.roleRepository.restore(id);

    await this.auditLogService.log({
      userId: actor?.id,
      userEmail: actor?.email,
      action: AuditAction.DATA_UPDATED,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.INFO,
      entityType: 'Role',
      entityId: role.id,
      description: `Role '${role.name}' was restored`,
      metadata: {
        role: {
          id: role.id,
          name: role.name,
          isSystem: role.isSystem,
          permissions: role.permissions,
        },
        actor: actor
          ? {
              id: actor.id,
              email: actor.email,
              ipAddress: actor.ipAddress,
              userAgent: actor.userAgent,
            }
          : undefined,
      },
      oldValues: {
        deletedAt: role.deletedAt,
      },
      newValues: {
        deletedAt: null,
      },
    });

    return this.findOne(role.id, false);
  }
}
