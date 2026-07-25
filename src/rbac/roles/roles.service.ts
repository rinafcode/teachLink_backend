import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';

export interface RbacAuditContext {
  actorId?: string;
  actorEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly auditLogService: AuditLogService,
    private readonly dataSource: DataSource,
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

  async findRoleById(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id }, relations: ['permissions'] });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  async updateRole(
    id: string,
    name: string,
    description?: string,
    permissionIds?: string[],
    context: RbacAuditContext = {},
  ): Promise<Role> {
    // Capture before-state and snapshots needed for audit outside the transaction.
    // These will be populated inside the transaction callback and used after commit.
    let previousPermissionIds: string[] = [];
    let updated: Role;

    await this.dataSource.transaction(async (manager) => {
      const roleRepo = manager.getRepository(Role);
      const permRepo = manager.getRepository(Permission);

      // Acquire a row-level write lock so concurrent updates to the same role
      // serialize behind this transaction rather than interleaving.
      const role = await roleRepo.findOne({
        where: { id },
        relations: ['permissions'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!role) {
        throw new NotFoundException(`Role with ID ${id} not found`);
      }

      previousPermissionIds = (role.permissions ?? []).map((p) => p.id);

      // 1. Update name / description.
      await roleRepo.update(id, { name, description });

      // 2. Replace the entire permission collection atomically.
      if (permissionIds !== undefined) {
        const permissions = await permRepo.findByIds(permissionIds);
        await roleRepo
          .createQueryBuilder()
          .relation(Role, 'permissions')
          .of(id)
          .set(permissions);
      }

      // 3. Re-fetch within the same transaction so the returned value is
      //    consistent with the writes above.
      const refreshed = await roleRepo.findOne({
        where: { id },
        relations: ['permissions'],
      });

      if (!refreshed) {
        // Should not happen, but guard against a race delete.
        throw new NotFoundException(`Role with ID ${id} not found after update`);
      }

      updated = refreshed;
    });

    // ── Post-commit work ────────────────────────────────────────────────────
    // The transaction has committed by this point. Any cache invalidation or
    // external side-effects must happen here so that they are never triggered
    // on a rolled-back transaction.

    // Write audit log after commit so it only records successful mutations.
    await this.writeAudit({
      action: AuditAction.RBAC_ROLE_UPDATED,
      role: updated!,
      context,
      metadata: {
        oldName: previousPermissionIds.length > 0 ? undefined : undefined, // populated below
        newName: updated!.name,
        previousPermissionIds,
        newPermissionIds: (updated!.permissions ?? []).map((p) => p.id),
      },
    });

    if (permissionIds !== undefined) {
      const newSet = new Set(permissionIds);
      const oldSet = new Set(previousPermissionIds);

      for (const permId of newSet) {
        if (!oldSet.has(permId)) {
          await this.writeAudit({
            action: AuditAction.RBAC_PERMISSION_GRANTED,
            role: updated!,
            context,
            metadata: { permissionId: permId },
          });
        }
      }
      for (const permId of oldSet) {
        if (!newSet.has(permId)) {
          await this.writeAudit({
            action: AuditAction.RBAC_PERMISSION_REVOKED,
            role: updated!,
            context,
            metadata: { permissionId: permId },
          });
        }
      }
    }

    return updated!;
  }

  async deleteRole(id: string, context: RbacAuditContext = {}): Promise<void> {
    // Snapshot the role before deletion so the audit row still records the name.
    const before = await this.roleRepository.findOne({ where: { id } });
    if (!before) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    const result = await this.roleRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    await this.writeAudit({
      action: AuditAction.RBAC_ROLE_DELETED,
      role: before,
      context,
      metadata: { name: before.name },
    });
  }

  async addPermissionToRole(
    roleId: string,
    permissionId: string,
    context: RbacAuditContext = {},
  ): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

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
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

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
  async logRoleAssigned(roleId: string, targetUserId: string, context: RbacAuditContext = {}) {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    await this.writeAudit({
      action: AuditAction.RBAC_ROLE_ASSIGNED,
      role,
      context,
      entityIdOverride: targetUserId,
      entityTypeOverride: 'user',
      metadata: { targetUserId, roleName: role.name },
    });
  }

  async logRoleRevoked(roleId: string, targetUserId: string, context: RbacAuditContext = {}) {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    await this.writeAudit({
      action: AuditAction.RBAC_ROLE_REVOKED,
      role,
      context,
      entityIdOverride: targetUserId,
      entityTypeOverride: 'user',
      metadata: { targetUserId, roleName: role.name },
    });
  }

  // ── Audit helper ───────────────────────────────────────────────────────────
  //
  // The audit log service swallows errors internally so audit failures can't
  // break the calling operation. We keep a same-shape helper so all RBAC
  // events flow into audit_logs with consistent category/severity.

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
      // Audit failures must never block a permission/role mutation.
      this.logger.warn(
        `Audit log write failed for ${action} on role ${role.id}: ${(err as Error).message}`,
      );
    }
  }
}
