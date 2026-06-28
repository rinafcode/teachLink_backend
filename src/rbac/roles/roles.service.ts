import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';

@Injectable()
export class RolesService {
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
    actorId?: string,
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

    await this.auditLogService.log({
      action: AuditAction.RBAC_ROLE_CREATED,
      category: AuditCategory.AUTHORIZATION,
      severity: AuditSeverity.INFO,
      userId: actorId,
      entityType: 'Role',
      entityId: saved.id,
      description: `Role "${name}" created`,
      metadata: { roleName: name, description, permissionIds },
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
    actorId?: string,
  ): Promise<Role> {
    const existing = await this.roleRepository.findOne({ where: { id }, relations: ['permissions'] });
    if (!existing) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    const oldValues = {
      name: existing.name,
      description: existing.description,
      permissionIds: existing.permissions?.map((p) => p.id) ?? [],
    };

    await this.roleRepository.update(id, { name, description });

    if (permissionIds !== undefined) {
      const permissions = await this.permissionRepository.findByIds(permissionIds);
      await this.roleRepository
        .createQueryBuilder()
        .relation(Role, 'permissions')
        .of(id)
        .set(permissions);
    }

    const updated = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });
    if (!updated) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    await this.auditLogService.log({
      action: AuditAction.RBAC_ROLE_UPDATED,
      category: AuditCategory.AUTHORIZATION,
      severity: AuditSeverity.INFO,
      userId: actorId,
      entityType: 'Role',
      entityId: id,
      description: `Role "${name}" updated`,
      oldValues,
      newValues: { name, description, permissionIds },
    });

    return updated;
  }

  async deleteRole(id: string, actorId?: string): Promise<void> {
    const existing = await this.roleRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    const result = await this.roleRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    await this.auditLogService.log({
      action: AuditAction.RBAC_ROLE_DELETED,
      category: AuditCategory.AUTHORIZATION,
      severity: AuditSeverity.WARNING,
      userId: actorId,
      entityType: 'Role',
      entityId: id,
      description: `Role "${existing.name}" deleted`,
      metadata: { roleName: existing.name },
    });
  }

  async addPermissionToRole(
    roleId: string,
    permissionId: string,
    actorId?: string,
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

    if (!role.permissions.some((p) => p.id === permission.id)) {
      role.permissions.push(permission);
      await this.roleRepository.save(role);

      await this.auditLogService.log({
        action: AuditAction.RBAC_PERMISSION_GRANTED,
        category: AuditCategory.AUTHORIZATION,
        severity: AuditSeverity.INFO,
        userId: actorId,
        entityType: 'Role',
        entityId: roleId,
        description: `Permission "${permission.action}" on "${permission.resource}" granted to role "${role.name}"`,
        metadata: {
          roleName: role.name,
          permissionId,
          permissionResource: permission.resource,
          permissionAction: permission.action,
        },
      });
    }

    return role;
  }

  async removePermissionFromRole(
    roleId: string,
    permissionId: string,
    actorId?: string,
  ): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
      relations: ['permissions'],
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    const permission = role.permissions.find((p) => p.id === permissionId);
    role.permissions = role.permissions.filter((p) => p.id !== permissionId);
    await this.roleRepository.save(role);

    await this.auditLogService.log({
      action: AuditAction.RBAC_PERMISSION_REVOKED,
      category: AuditCategory.AUTHORIZATION,
      severity: AuditSeverity.WARNING,
      userId: actorId,
      entityType: 'Role',
      entityId: roleId,
      description: `Permission "${permission?.action ?? permissionId}" on "${permission?.resource ?? 'unknown'}" revoked from role "${role.name}"`,
      metadata: {
        roleName: role.name,
        permissionId,
        permissionResource: permission?.resource,
        permissionAction: permission?.action,
      },
    });

    return role;
  }
}
