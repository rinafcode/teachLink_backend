import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';

/**
 * Builds a minimal transactional entity-manager mock.
 * The `overrides` map lets individual tests replace specific methods
 * (e.g. force the relation .set() to throw).
 */
function buildManagerMock(overrides: {
  roleFindOne?: jest.Mock;
  permFindByIds?: jest.Mock;
  roleUpdate?: jest.Mock;
  relationSet?: jest.Mock;
  roleQueryFindOne?: jest.Mock;
} = {}) {
  const relationSet = overrides.relationSet ?? jest.fn().mockResolvedValue(undefined);
  const roleFindOne = overrides.roleFindOne ?? jest.fn();
  const roleQueryFindOne = overrides.roleQueryFindOne ?? jest.fn();
  const permFindByIds = overrides.permFindByIds ?? jest.fn().mockResolvedValue([]);
  const roleUpdate = overrides.roleUpdate ?? jest.fn().mockResolvedValue({ affected: 1 });

  const roleRepo = {
    findOne: jest.fn()
      .mockImplementationOnce(roleFindOne)  // first call: lock fetch
      .mockImplementation(roleQueryFindOne), // second call: post-update refresh
    update: roleUpdate,
    findByIds: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      relation: () => ({ of: () => ({ set: relationSet }) }),
    })),
  };

  const permRepo = {
    findByIds: permFindByIds,
  };

  return {
    getRepository: jest.fn((entity) => {
      if (entity === Role) return roleRepo;
      if (entity === Permission) return permRepo;
    }),
    roleRepo,
    permRepo,
    relationSet,
  };
}

/**
 * Issue #833 — verifies that every RolesService mutation writes an audit
 * log entry with the expected action, category, severity and entity metadata.
 *
 * Issue #1050 — verifies that updateRole is atomic: a failure during the
 * permission set step rolls back the name change.
 */
describe('RolesService (audit integration, Issue #833 + #1050)', () => {
  let service: RolesService;
  let roleRepository: jest.Mocked<Repository<Role>>;
  let permissionRepository: jest.Mocked<Repository<Permission>>;
  let auditLogService: jest.Mocked<Pick<AuditLogService, 'log'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;

  const baseRole: Role = {
    id: 'role-1',
    name: 'admin',
    description: 'Admin role',
    permissions: [],
    users: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
      findByIds: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => ({
        relation: () => ({ of: () => ({ set: jest.fn().mockResolvedValue(undefined) }) }),
      })),
    } as any;

    permissionRepository = {
      findByIds: jest.fn(),
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

  // ── Issue #833 tests (existing behavior preserved) ──────────────────────

  it('createRole writes RBAC_ROLE_CREATED audit entry', async () => {
    await service.createRole('admin', 'Admin role', [], { actorId: 'u1' });
    expectAudit(AuditAction.RBAC_ROLE_CREATED, 'role-1');
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        metadata: expect.objectContaining({ roleId: 'role-1', roleName: 'admin' }),
      }),
    );
  });

  it('addPermissionToRole writes RBAC_PERMISSION_GRANTED audit entry', async () => {
    const perm: Permission = {
      id: 'p1',
      resource: 'users',
      action: 'read',
      description: 'read users',
      roles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    roleRepository.findOne.mockResolvedValueOnce({ ...baseRole, permissions: [] });
    permissionRepository.findOneBy.mockResolvedValueOnce(perm);

    await service.addPermissionToRole('role-1', 'p1');
    expectAudit(AuditAction.RBAC_PERMISSION_GRANTED, 'role-1');
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          permissionId: 'p1',
          newlyGranted: true,
        }),
      }),
    );
  });

  it('removePermissionFromRole writes RBAC_PERMISSION_REVOKED audit entry', async () => {
    const perm: Permission = {
      id: 'p1',
      resource: 'users',
      action: 'read',
      description: 'read users',
      roles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    roleRepository.findOne.mockResolvedValueOnce({ ...baseRole, permissions: [perm] });

    await service.removePermissionFromRole('role-1', 'p1');
    expectAudit(AuditAction.RBAC_PERMISSION_REVOKED, 'role-1');
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          permissionId: 'p1',
          wasPresent: true,
        }),
      }),
    );
  });

  it('updateRole with new permissionIds writes RBAC_PERMISSION_GRANTED and RBAC_PERMISSION_REVOKED deltas', async () => {
    const beforePerm: Permission = {
      id: 'p-old',
      resource: 'old',
      action: 'read',
      description: '',
      roles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const afterPerm: Permission = {
      id: 'p-new',
      resource: 'new',
      action: 'read',
      description: '',
      roles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Override the transaction mock for this test to return a role that already
    // has the updated permissions (simulating a successful commit).
    const manager = buildManagerMock({
      roleFindOne: jest.fn().mockResolvedValue({ ...baseRole, permissions: [beforePerm] }),
      permFindByIds: jest.fn().mockResolvedValue([afterPerm]),
      roleQueryFindOne: jest.fn().mockResolvedValue({ ...baseRole, name: 'admin', permissions: [afterPerm] }),
    });

    (dataSource.transaction as jest.Mock).mockImplementationOnce(
      async (cb: (mgr: any) => Promise<any>) => cb(manager),
    );

    await service.updateRole('role-1', 'admin', undefined, ['p-new']);

    expectAudit(AuditAction.RBAC_ROLE_UPDATED, 'role-1');
    expectAudit(AuditAction.RBAC_PERMISSION_GRANTED, 'role-1');
    expectAudit(AuditAction.RBAC_PERMISSION_REVOKED, 'role-1');
  });

  it('deleteRole writes RBAC_ROLE_DELETED audit entry', async () => {
    roleRepository.findOne.mockResolvedValueOnce({ ...baseRole });
    await service.deleteRole('role-1');
    expectAudit(AuditAction.RBAC_ROLE_DELETED, 'role-1');
  });

  it('logRoleAssigned writes RBAC_ROLE_ASSIGNED with target user id as entity', async () => {
    roleRepository.findOne.mockResolvedValueOnce({ ...baseRole });
    await service.logRoleAssigned('role-1', 'user-7', { actorId: 'admin-1' });
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.RBAC_ROLE_ASSIGNED,
        entityType: 'user',
        entityId: 'user-7',
        userId: 'admin-1',
        metadata: expect.objectContaining({ targetUserId: 'user-7' }),
      }),
    );
  });

  it('logRoleRevoked writes RBAC_ROLE_REVOKED with target user id as entity', async () => {
    roleRepository.findOne.mockResolvedValueOnce({ ...baseRole });
    await service.logRoleRevoked('role-1', 'user-7');
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

      await expect(
        service.updateRole('role-1', 'new-name', undefined, ['p-1']),
      ).rejects.toThrow('DB constraint violation');

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

      await expect(
        service.updateRole('missing-id', 'new-name'),
      ).rejects.toThrow(NotFoundException);

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
        roleQueryFindOne: jest.fn().mockResolvedValue({ ...baseRole, name: 'updated-name', permissions: [] }),
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
