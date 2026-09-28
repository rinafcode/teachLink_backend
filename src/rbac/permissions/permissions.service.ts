import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';
import { RbacAuditContext } from '../roles/roles.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { OffsetPaginatedResponse } from '../../common/interfaces/pagination.interface';
import { buildOffsetResponse } from '../../common/utils/pagination.utils';
import { RbacCacheService } from '../rbac-cache.service';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly auditLogService: AuditLogService,
    private readonly rbacCacheService: RbacCacheService,
  ) {}

  async createPermission(
    resource: string,
    action: string,
    description?: string,
    context: RbacAuditContext = {},
  ): Promise<Permission> {
    const permission = this.permissionRepository.create({
      resource,
      action,
      description,
    });
    const saved = await this.permissionRepository.save(permission);

    await this.writeAudit({
      action: AuditAction.RBAC_PERMISSION_CREATED,
      permission: saved,
      context,
    });

    return saved;
  }

  async findAllPermissions(
    query?: PaginationQueryDto,
  ): Promise<OffsetPaginatedResponse<Permission>> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const sortBy = query?.sortBy ?? 'createdAt';
    const order = query?.order ?? 'DESC';

    const [data, total] = await this.permissionRepository.findAndCount({
      order: { [sortBy]: order },
      skip: (page - 1) * limit,
      take: limit,
    });

    return buildOffsetResponse(data, total, page, limit);
  }

  async findPermissionById(id: string): Promise<Permission> {
    const permission = await this.permissionRepository.findOneBy({ id });
    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }
    return permission;
  }

  async updatePermission(
    id: string,
    resource: string,
    action: string,
    description?: string,
    context: RbacAuditContext = {},
  ): Promise<Permission> {
    const before = await this.findPermissionById(id);

    await this.permissionRepository.update(id, { resource, action, description });
    const updated = await this.permissionRepository.findOneBy({ id });
    if (!updated) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    await this.rbacCacheService.invalidateAllRoles();

    await this.writeAudit({
      action: AuditAction.RBAC_PERMISSION_UPDATED,
      permission: updated,
      context,
      metadata: {
        previous: {
          resource: before.resource,
          action: before.action,
          description: before.description ?? null,
        },
        next: {
          resource: updated.resource,
          action: updated.action,
          description: updated.description ?? null,
        },
      },
    });

    return updated;
  }

  async deletePermission(id: string, context: RbacAuditContext = {}): Promise<void> {
    const before = await this.permissionRepository.findOneBy({ id });
    if (!before) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    // Prevent deletion while the permission is still attached to roles
    const roleCount = await this.roleRepository
      .createQueryBuilder('role')
      .innerJoin('role.permissions', 'permission', 'permission.id = :permissionId', {
        permissionId: id,
      })
      .getCount();

    if (roleCount > 0) {
      throw new ConflictException({
        message: `Permission '${before.resource}:${before.action}' is currently assigned to ${roleCount} role(s). Remove it from all roles before deleting.`,
        count: roleCount,
        permissionId: before.id,
      });
    }

    const result = await this.permissionRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    await this.rbacCacheService.invalidateAllRoles();

    await this.writeAudit({
      action: AuditAction.RBAC_PERMISSION_DELETED,
      permission: before,
      context,
      metadata: { resource: before.resource, action: before.action },
    });
  }

  // ── Audit helper ───────────────────────────────────────────────────────────

  private async writeAudit(args: {
    action: AuditAction;
    permission: Permission;
    context: RbacAuditContext;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { action, permission, context, metadata = {} } = args;

    try {
      await this.auditLogService.log({
        action,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.WARNING,
        entityType: 'permission',
        entityId: permission.id,
        userId: context.actorId ?? null,
        userEmail: context.actorEmail ?? null,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
        description: `${action} for permission "${permission.resource}:${permission.action}" (${permission.id})`,
        metadata: {
          ...metadata,
          permissionId: permission.id,
          resource: permission.resource,
          actionVerb: permission.action,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Audit log write failed for ${action} on permission ${permission.id}: ${(err as Error).message}`,
      );
    }
  }
}
