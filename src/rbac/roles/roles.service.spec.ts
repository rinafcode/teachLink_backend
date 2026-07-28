import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  AuditAction,
  AuditCategory,
  AuditSeverity,
} from '../../audit-log/enums/audit-action.enum';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;
  let roleRepository: jest.Mocked<Repository<Role>>;
  let permissionRepository: jest.Mocked<Repository<Permission>>;
  let auditLogService: jest.Mocked<Pick<AuditLogService, 'log'>>;

  const baseRole: Role = {
    id: 'role-1',
    name: 'admin',
    description: 'Admin role',
    isSystem: true,
    permissions: [],
    users: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as Role;

  beforeEach(async () => {
    roleRepository = {
      create: jest.fn().mockImplementation((dto) => ({ ...baseRole, ...dto })),
      save: jest.fn().mockImplementation(async (role) => ({ ...role, id: role.id ?? 'role-1' })),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      softDelete: jest.fn().mockResolvedValue({ affected: 1, raw: {} }),
      restore: jest.fn().mockResolvedValue({ affected: 1, raw: {} }),
      createQueryBuilder: jest.fn(() => ({
        relation: () => ({ of: () => ({ set: jest.fn().mockResolvedValue(undefined) }) }),
      })),
    } as any;

    permissionRepository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
    } as any;

    auditLogService = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: roleRepository },
        { provide: getRepositoryToken(Permission), useValue: permissionRepository },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get(RolesService);
  });

  const expectAudit = (action: AuditAction, entityId: string) => {
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.WARNING,
        entityType: 'role',
        entityId,
      }),
    );
  };

  it('queries permissions with In() and creates a role successfully', async () => {
    const permission = { id: 'perm-1', name: 'read' } as Permission;
    permissionRepository.find.mockResolvedValue([permission]);

    const result = await service.createRole('Editor', 'Editor role', ['perm-1']);

    expect(permissionRepository.find).toHaveBeenCalledWith({
      where: { id: In(['perm-1']) },
    });
    expect(result.permissions).toEqual([permission]);
  });

  it('throws BadRequestException when createRole is given a non-existent permission ID', async () => {
    permissionRepository.find.mockResolvedValue([]);

    await expect(
      service.createRole('Editor', 'Editor role', ['invalid-id']),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws a conflict when the role is in use', async () => {
    roleRepository.findOne.mockResolvedValueOnce({
      ...baseRole,
      name: 'moderator',
      isSystem: false,
      users: [{ id: 'user-1' }, { id: 'user-2' }] as never,
    });

    await expect(service.deleteRole('role-1')).rejects.toBeInstanceOf(ConflictException);
    expect(roleRepository.softDelete).not.toHaveBeenCalled();
    expect(auditLogService.log).not.toHaveBeenCalled();
  });

  it('blocks deletion for built-in system roles', async () => {
    roleRepository.findOne.mockResolvedValueOnce({
      ...baseRole,
      name: 'admin',
      isSystem: true,
      users: [],
    });

    await expect(service.deleteRole('role-2')).rejects.toBeInstanceOf(ConflictException);
    expect(roleRepository.softDelete).not.toHaveBeenCalled();
    expect(auditLogService.log).not.toHaveBeenCalled();
  });

  it('soft-deletes and restores a role without losing permissions', async () => {
    const permission = {
      id: 'perm-1',
      resource: 'users',
      action: 'read',
      description: 'read users',
      roles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Permission;

    const deletedRole = {
      id: 'role-3',
      name: 'mentor',
      description: 'Mentor role',
      isSystem: false,
      permissions: [permission],
      users: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as Role;

    const restoredRole = {
      ...deletedRole,
      deletedAt: null,
    } as Role;

    roleRepository.findOne
      .mockResolvedValueOnce(deletedRole)
      .mockResolvedValueOnce(deletedRole)
      .mockResolvedValueOnce(restoredRole);
    permissionRepository.find.mockResolvedValue([permission]);

    await service.deleteRole('role-3', { actorId: 'admin-1', actorEmail: 'admin@example.com' });

    expect(roleRepository.softDelete).toHaveBeenCalledWith('role-3');
    expectAudit(AuditAction.RBAC_ROLE_DELETED, 'role-3');
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          affectedAssignments: 0,
          roleId: 'role-3',
          roleName: 'mentor',
        }),
      }),
    );

    const restored = await service.restoreRole('role-3', { actorId: 'admin-1' });

    expect(roleRepository.restore).toHaveBeenCalledWith('role-3');
    expect(restored.permissions).toEqual([permission]);
    expect(restored.deletedAt).toBeNull();
    expectAudit(AuditAction.RBAC_ROLE_UPDATED, 'role-3');
  });

  it('writes audit entries for permission changes and role assignment events', async () => {
    const permission = {
      id: 'perm-2',
      resource: 'users',
      action: 'write',
      description: 'write users',
      roles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Permission;

    roleRepository.findOne
      .mockResolvedValueOnce({
        ...baseRole,
        id: 'role-4',
        name: 'mentor',
        isSystem: false,
        permissions: [],
        users: [],
      })
      .mockResolvedValueOnce({
        ...baseRole,
        id: 'role-4',
        name: 'mentor',
        isSystem: false,
        permissions: [],
        users: [],
      })
      .mockResolvedValueOnce({
        ...baseRole,
        id: 'role-4',
        name: 'mentor',
        isSystem: false,
        permissions: [permission],
        users: [],
      })
      .mockResolvedValueOnce({
        ...baseRole,
        id: 'role-4',
        name: 'mentor',
        isSystem: false,
        permissions: [permission],
        users: [],
      })
      .mockResolvedValueOnce({
        ...baseRole,
        id: 'role-4',
        name: 'mentor',
        isSystem: false,
        permissions: [permission],
        users: [],
      })
      .mockResolvedValueOnce({
        ...baseRole,
        id: 'role-4',
        name: 'mentor',
        isSystem: false,
        permissions: [permission],
        users: [],
      });

    permissionRepository.findOneBy.mockResolvedValue(permission);
    permissionRepository.find.mockResolvedValue([permission]);

    await service.addPermissionToRole('role-4', 'perm-2');
    await service.removePermissionFromRole('role-4', 'perm-2');
    await service.logRoleAssigned('role-4', 'user-7', { actorId: 'admin-1' });
    await service.logRoleRevoked('role-4', 'user-7');

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.RBAC_PERMISSION_GRANTED,
        metadata: expect.objectContaining({
          permissionId: 'perm-2',
          newlyGranted: true,
        }),
      }),
    );
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.RBAC_PERMISSION_REVOKED,
        metadata: expect.objectContaining({
          permissionId: 'perm-2',
        }),
      }),
    );
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.RBAC_ROLE_ASSIGNED,
        entityType: 'user',
        entityId: 'user-7',
      }),
    );
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.RBAC_ROLE_REVOKED,
        entityType: 'user',
        entityId: 'user-7',
      }),
    );
  });
});