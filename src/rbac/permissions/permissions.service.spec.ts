import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionsService } from './permissions.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';
import { ConflictException } from '@nestjs/common';

/**
 * Issue #833 — verifies PermissionsService mutations emit audit log entries.
 * Issue #967 — verifies role-reference check on permission deletion.
 */
describe('PermissionsService (audit integration, Issue #833)', () => {
  let service: PermissionsService;
  let permissionRepository: jest.Mocked<Repository<Permission>>;
  let roleRepository: jest.Mocked<Repository<Role>>;
  let auditLogService: jest.Mocked<Pick<AuditLogService, 'log'>>;

  const basePermission: Permission = {
    id: 'perm-1',
    resource: 'users',
    action: 'read',
    description: 'Read users',
    roles: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    permissionRepository = {
      create: jest.fn().mockImplementation((dto) => ({ ...basePermission, ...dto })),
      save: jest.fn().mockImplementation(async (p) => ({ ...p, id: p.id ?? 'perm-1' })),
      find: jest.fn(),
      findOneBy: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    } as any;

    roleRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      }),
    } as any;

    auditLogService = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: getRepositoryToken(Permission), useValue: permissionRepository },
        { provide: getRepositoryToken(Role), useValue: roleRepository },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get(PermissionsService);
  });

  const expectAudit = (action: AuditAction) => {
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.WARNING,
        entityType: 'permission',
      }),
    );
  };

  it('createPermission writes RBAC_PERMISSION_CREATED audit entry', async () => {
    await service.createPermission('users', 'read', 'Read users', { actorId: 'u1' });
    expectAudit(AuditAction.RBAC_PERMISSION_CREATED);
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        metadata: expect.objectContaining({
          resource: 'users',
          actionVerb: 'read',
        }),
      }),
    );
  });

  it('updatePermission writes RBAC_PERMISSION_UPDATED audit entry with diff', async () => {
    permissionRepository.findOneBy
      .mockResolvedValueOnce({ ...basePermission }) // before-snapshot lookup
      .mockResolvedValueOnce({
        ...basePermission,
        resource: 'users',
        action: 'write',
        description: 'Write users',
      }); // post-update fetch
    await service.updatePermission('perm-1', 'users', 'write', 'Write users');

    expectAudit(AuditAction.RBAC_PERMISSION_UPDATED);
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          previous: expect.objectContaining({ resource: 'users', action: 'read' }),
          next: expect.objectContaining({ resource: 'users', action: 'write' }),
        }),
      }),
    );
  });

  it('deletePermission writes RBAC_PERMISSION_DELETED audit entry', async () => {
    permissionRepository.findOneBy.mockResolvedValueOnce({ ...basePermission });
    await service.deletePermission('perm-1');
    expectAudit(AuditAction.RBAC_PERMISSION_DELETED);
  });

  // ── Issue #967 — deletion conflict when permission is still attached to roles ──

  it('deletePermission throws ConflictException when permission is still assigned to roles', async () => {
    permissionRepository.findOneBy.mockResolvedValueOnce({ ...basePermission });

    // Simulate 3 roles still referencing this permission
    (roleRepository.createQueryBuilder as jest.Mock).mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(3),
    });

    await expect(service.deletePermission('perm-1')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.deletePermission('perm-1')).rejects.toMatchObject({
      message: expect.stringContaining('3 role(s)'),
    });
  });

  it('deletePermission succeeds when no roles reference the permission', async () => {
    permissionRepository.findOneBy
      .mockResolvedValueOnce({ ...basePermission }); // before lookup

    // Simulate 0 roles referencing this permission
    (roleRepository.createQueryBuilder as jest.Mock).mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    });

    await expect(service.deletePermission('perm-1')).resolves.toBeUndefined();
    expect(permissionRepository.delete).toHaveBeenCalledWith('perm-1');
  });
});
