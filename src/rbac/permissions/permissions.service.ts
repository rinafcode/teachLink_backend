import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createPermission(
    resource: string,
    action: string,
    description?: string,
    actorId?: string,
  ): Promise<Permission> {
    const permission = this.permissionRepository.create({
      resource,
      action,
      description,
    });
    const saved = await this.permissionRepository.save(permission);

    await this.auditLogService.log({
      action: AuditAction.RBAC_PERMISSION_CREATED,
      category: AuditCategory.AUTHORIZATION,
      severity: AuditSeverity.INFO,
      userId: actorId,
      entityType: 'Permission',
      entityId: saved.id,
      description: `Permission "${action}" on "${resource}" created`,
      metadata: { resource, action: action, description },
    });

    return saved;
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository.find();
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
    actorId?: string,
  ): Promise<Permission> {
    const existing = await this.permissionRepository.findOneBy({ id });
    if (!existing) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    const oldValues = {
      resource: existing.resource,
      action: existing.action,
      description: existing.description,
    };

    await this.permissionRepository.update(id, { resource, action, description });
    const updated = await this.permissionRepository.findOneBy({ id });
    if (!updated) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    await this.auditLogService.log({
      action: AuditAction.RBAC_PERMISSION_UPDATED,
      category: AuditCategory.AUTHORIZATION,
      severity: AuditSeverity.INFO,
      userId: actorId,
      entityType: 'Permission',
      entityId: id,
      description: `Permission "${action}" on "${resource}" updated`,
      oldValues,
      newValues: { resource, action: action, description },
    });

    return updated;
  }

  async deletePermission(id: string, actorId?: string): Promise<void> {
    const existing = await this.permissionRepository.findOneBy({ id });
    if (!existing) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    const result = await this.permissionRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    await this.auditLogService.log({
      action: AuditAction.RBAC_PERMISSION_DELETED,
      category: AuditCategory.AUTHORIZATION,
      severity: AuditSeverity.WARNING,
      userId: actorId,
      entityType: 'Permission',
      entityId: id,
      description: `Permission "${existing.action}" on "${existing.resource}" deleted`,
      metadata: { resource: existing.resource, action: existing.action },
    });
  }
}
