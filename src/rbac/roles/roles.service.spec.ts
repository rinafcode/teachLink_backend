import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolesService } from './roles.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';

/**
 * Issue #833 — verifies that every RolesService mutation writes an audit
 * log entry with the expected action, category, severity and entity metadata.
 */
describe('RolesService (audit integration, Issue #833)', () => {
  let service: RolesService;
  let roleRepository: jest.Mocked<Repository<Role>>;
  let permissionRepository: jest.Mocked<Repository<Permission>>;
  let auditLogService: jest.Mocked<Pick<AuditLogService, 'log'>>;

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
    roleRepository.findOne
      .mockResolvedValueOnce({ ...baseRole, permissions: [beforePerm] }) // initial fetch
      .mockResolvedValueOnce({ ...baseRole, name: 'admin', permissions: [afterPerm] }); // post-update fetch
    permissionRepository.findByIds.mockResolvedValueOnce([afterPerm]);

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
});
