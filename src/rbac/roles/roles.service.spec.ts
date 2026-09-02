import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;
  let roleRepository: jest.Mocked<Repository<Role>>;
  let permissionRepository: jest.Mocked<Repository<Permission>>;
  let auditLogService: jest.Mocked<Pick<AuditLogService, 'log'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;

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
    // Default manager — succeeds for every operation.
    const defaultManager = buildManagerMock({
      roleFindOne: jest.fn().mockResolvedValue({ ...baseRole, permissions: [] }),
      roleQueryFindOne: jest.fn().mockResolvedValue({ ...baseRole, permissions: [] }),
    });

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

    // Default DataSource mock: executes the callback with the default manager
    // and resolves its return value (mimicking a committed transaction).
    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (mgr: any) => Promise<any>) => {
        return cb(defaultManager);
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: roleRepository },
        { provide: getRepositoryToken(Permission), useValue: permissionRepository },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: DataSource, useValue: dataSource },
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

    await expect(service.createRole('Editor', 'Editor role', ['invalid-id'])).rejects.toThrow(
      BadRequestException,
    );
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

  // ── Issue #1050 tests (atomicity & rollback) ─────────────────────────────

  describe('updateRole atomicity (Issue #1050)', () => {
    it('rolls back the name change when the permission set step throws', async () => {
      // Simulate a DB error on the relation .set() call.
      const permSetError = new Error('DB constraint violation');
      const manager = buildManagerMock({
        roleFindOne: jest.fn().mockResolvedValue({ ...baseRole, permissions: [] }),
        permFindByIds: jest.fn().mockResolvedValue([]),
        relationSet: jest.fn().mockRejectedValue(permSetError),
      });

      // The transaction mock re-throws when the callback throws — this
      // mirrors real TypeORM behaviour where an exception triggers rollback.
      (dataSource.transaction as jest.Mock).mockImplementationOnce(
        async (cb: (mgr: any) => Promise<any>) => {
          // The callback will throw; we propagate it so the caller sees the error.
          return cb(manager);
        },
      );

      await expect(service.updateRole('role-1', 'new-name', undefined, ['p-1'])).rejects.toThrow(
        'DB constraint violation',
      );

      // The transaction threw, so the update call inside the transaction
      // is the only place the name change would be persisted.
      // Assert that roleRepo.update was called inside the transaction
      // (i.e. the transactional repo, not the injected one).
      expect(manager.roleRepo.update).toHaveBeenCalledWith('role-1', {
        name: 'new-name',
        description: undefined,
      });

      // The outer roleRepository (used by non-transactional methods) must
      // NOT have been touched — the atomic path uses the manager's repo.
      expect(roleRepository.update).not.toHaveBeenCalled();

      // Audit must NOT have been written because the transaction never committed.
      expect(auditLogService.log).not.toHaveBeenCalled();
    });

    it('does not write audit log when the role does not exist (NotFoundException inside tx)', async () => {
      const manager = buildManagerMock({
        roleFindOne: jest.fn().mockResolvedValue(null), // role not found
      });

      (dataSource.transaction as jest.Mock).mockImplementationOnce(
        async (cb: (mgr: any) => Promise<any>) => cb(manager),
      );

      await expect(service.updateRole('missing-id', 'new-name')).rejects.toThrow(NotFoundException);

      // No audit must be written for a non-existent role.
      expect(auditLogService.log).not.toHaveBeenCalled();
    });

    it('wraps all writes in a single dataSource.transaction call', async () => {
      await service.updateRole('role-1', 'updated-name');
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('writes audit log only after the transaction commits', async () => {
      const callOrder: string[] = [];

      const manager = buildManagerMock({
        roleFindOne: jest.fn().mockResolvedValue({ ...baseRole, permissions: [] }),
        roleQueryFindOne: jest
          .fn()
          .mockResolvedValue({ ...baseRole, name: 'updated-name', permissions: [] }),
      });

      (dataSource.transaction as jest.Mock).mockImplementationOnce(
        async (cb: (mgr: any) => Promise<any>) => {
          const result = await cb(manager);
          callOrder.push('transaction-committed');
          return result;
        },
      );

      (auditLogService.log as jest.Mock).mockImplementationOnce(async () => {
        callOrder.push('audit-written');
        return {};
      });

      await service.updateRole('role-1', 'updated-name');

      expect(callOrder).toEqual(['transaction-committed', 'audit-written']);
    });
  });
});
