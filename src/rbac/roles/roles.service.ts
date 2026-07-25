import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';
import { Permission } from '../entities/permission.entity';
import { BUILTIN_ROLE_NAMES, Role } from '../entities/role.entity';

export interface RbacAuditContext {
  actorId?: string;
  actorEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Provides role management operations.
 */
@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createRole(
    name: string,
    description?: string,
    permissionIds?: string[],
    context: RbacAuditContext = {},
  ): Promise<Role> {
    const role = this.roleRepository.create({
      name,
      description,
      isSystem: BUILTIN_ROLE_NAMES.includes(name as (typeof BUILTIN_ROLE_NAMES)[number]),
    });

    if (permissionIds && permissionIds.length > 0) {
      const permissions = await this.permissionRepository.findByIds(permissionIds);
      role.permissions = permissions;
    }

    const saved = await this.roleRepository.save(role);

    await this.writeAudit({
      action: AuditAction.RBAC_ROLE_CREATED,
      role: saved,
      context,
      metadata: {
        permissionIds: permissionIds ?? [],
      },
    });

    return saved;
  }

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepository.find({ relations: ['permissions'] });
  }

  async findRoleById(id: string, includeDeleted = false): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions', 'users'],
      withDeleted: includeDeleted,
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  async findRoleByName(name: string, includeDeleted = false): Promise<Role | null> {
    return this.roleRepository.findOne({
      where: { name },
      relations: ['permissions', 'users'],
      withDeleted: includeDeleted,
    });
  }

  async isRoleActive(name: string): Promise<boolean> {
    const role = await this.findRoleByName(name, true);
    if (!role) {
      return false;
    }

    return role.deletedAt == null;
  }

  async updateRole(
    id: string,
    name: string,
    description?: string,
    permissionIds?: string[],
    context: RbacAuditContext = {},
  ): Promise<Role> {
    const before = await this.findRoleById(id, true);
    const previousPermissionIds = (before.permissions ?? []).map((p) => p.id);

    await this.roleRepository.update(id, {
      name,
      description,
      isSystem: BUILTIN_ROLE_NAMES.includes(name as (typeof BUILTIN_ROLE_NAMES)[number]),
    });

    if (permissionIds !== undefined) {
      const permissions = await this.permissionRepository.findByIds(permissionIds);
      await this.roleRepository
        .createQueryBuilder()
        .relation(Role, 'permissions')
        .of(id)
        .set(permissions);
    }

    const updated = await this.findRoleById(id, true);

    await this.writeAudit({
      action: AuditAction.RBAC_ROLE_UPDATED,
      role: updated,
      context,
      metadata: {
        oldName: before.name,
        newName: updated.name,
        previousPermissionIds,
        newPermissionIds: (updated.permissions ?? []).map((p) => p.id),
      },
    });

    if (permissionIds !== undefined) {
      const newSet = new Set(permissionIds);
      const oldSet = new Set(previousPermissionIds);

      for (const permId of newSet) {
        if (!oldSet.has(permId)) {
          await this.writeAudit({
            action: AuditAction.RBAC_PERMISSION_GRANTED,
            role: updated,
            context,
            metadata: { permissionId: permId },
          });
        }
      }

      for (const permId of oldSet) {
        if (!newSet.has(permId)) {
          await this.writeAudit({
            action: AuditAction.RBAC_PERMISSION_REVOKED,
            role: updated,
            context,
            metadata: { permissionId: permId },
          });
        }
      }
    }

    return updated;
  }

  async deleteRole(id: string, context: RbacAuditContext = {}): Promise<void> {
    const before = await this.findRoleById(id, true);

    if (before.isSystem || BUILTIN_ROLE_NAMES.includes(before.name as (typeof BUILTIN_ROLE_NAMES)[number])) {
      throw new ConflictException(`System role '${before.name}' cannot be deleted`);
    }

    const userCount = before.users?.length ?? 0;
    if (userCount > 0) {
      throw new ConflictException({
        message: `Role '${before.name}' is currently assigned to ${userCount} user(s)`,
        count: userCount,
        roleId: before.id,
      });
    }

    await this.roleRepository.softDelete(id);

    await this.writeAudit({
      action: AuditAction.RBAC_ROLE_DELETED,
      role: before,
      context,
      metadata: {
        affectedAssignments: userCount,
      },
    });
  }

  async restoreRole(id: string, context: RbacAuditContext = {}): Promise<Role> {
    const before = await this.findRoleById(id, true);

    await this.roleRepository.restore(id);

    const restored = await this.findRoleById(id);

    await this.writeAudit({
      action: AuditAction.RBAC_ROLE_UPDATED,
      role: restored,
      context,
      metadata: {
        restoredFromDeletedAt: before.deletedAt,
      },
    });

    return restored;
  }

  async addPermissionToRole(
    roleId: string,
    permissionId: string,
    context: RbacAuditContext = {},
  ): Promise<Role> {
    const role = await this.findRoleById(roleId);
    const permission = await this.permissionRepository.findOneBy({ id: permissionId });
    if (!permission) {
      throw new NotFoundException(`Permission with ID ${permissionId} not found`);
    }

    let granted = false;
    if (!role.permissions.some((p) => p.id === permission.id)) {
      role.permissions.push(permission);
      await this.roleRepository.save(role);
      granted = true;
    }

    await this.writeAudit({
      action: AuditAction.RBAC_PERMISSION_GRANTED,
      role,
      context,
      metadata: {
        permissionId,
        permissionResource: permission.resource,
        permissionAction: permission.action,
        newlyGranted: granted,
      },
    });

    return role;
  }

  async removePermissionFromRole(
    roleId: string,
    permissionId: string,
    context: RbacAuditContext = {},
  ): Promise<Role> {
    const role = await this.findRoleById(roleId);

    const hadPermission = role.permissions.some((p) => p.id === permissionId);
    role.permissions = role.permissions.filter((p) => p.id !== permissionId);
    await this.roleRepository.save(role);

    await this.writeAudit({
      action: AuditAction.RBAC_PERMISSION_REVOKED,
      role,
      context,
      metadata: {
        permissionId,
        wasPresent: hadPermission,
      },
    });

    return role;
  }

  /**
   * Issues #833 — assign a role to a target user.
   *
   * This handler is intentionally minimal: it only writes the audit log. The
   * actual join-table ownership lives in the User entity; production callers
   * are expected to ensure the assignment persists. Keeping the audit
   * emission inside the service lets callers (e.g. controllers) record the
   * intent even if persistence is performed elsewhere.
   */
  async logRoleAssigned(roleId: string, targetUserId: string, context: RbacAuditContext = {}): Promise<void> {
    const role = await this.findRoleById(roleId);

    await this.writeAudit({
      action: AuditAction.RBAC_ROLE_ASSIGNED,
      role,
      context,
      entityIdOverride: targetUserId,
      entityTypeOverride: 'user',
      metadata: { targetUserId, roleName: role.name },
    });
  }

  async logRoleRevoked(roleId: string, targetUserId: string, context: RbacAuditContext = {}): Promise<void> {
    const role = await this.findRoleById(roleId);

    await this.writeAudit({
      action: AuditAction.RBAC_ROLE_REVOKED,
      role,
      context,
      entityIdOverride: targetUserId,
      entityTypeOverride: 'user',
      metadata: { targetUserId, roleName: role.name },
    });
  }

  private async writeAudit(args: {
    action: AuditAction;
    role: Role;
    context: RbacAuditContext;
    metadata: Record<string, unknown>;
    entityIdOverride?: string;
    entityTypeOverride?: string;
  }): Promise<void> {
    const { action, role, context, metadata, entityIdOverride, entityTypeOverride } = args;

    try {
      await this.auditLogService.log({
        action,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.WARNING,
        entityType: entityTypeOverride ?? 'role',
        entityId: entityIdOverride ?? role.id,
        userId: context.actorId ?? null,
        userEmail: context.actorEmail ?? null,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
        description: `${action} for role "${role.name}" (${role.id})`,
        metadata: {
          ...metadata,
          roleId: role.id,
          roleName: role.name,
        },
      });
    } catch (err) {
      this.logger.warn(`Audit log write failed for ${action} on role ${role.id}: ${(err as Error).message}`);
    }
  }
}
