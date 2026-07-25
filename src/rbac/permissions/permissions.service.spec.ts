import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionsService } from './permissions.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { Permission } from '../entities/permission.entity';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';

/**
 * Issue #833 — verifies PermissionsService mutations emit audit log entries.
 */
describe('PermissionsService (audit integration, Issue #833)', () => {
  let service: PermissionsService;
  let permissionRepository: jest.Mocked<Repository<Permission>>;
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
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    } as any;

    auditLogService = { log: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: getRepositoryToken(Permission), useValue: permissionRepository },
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
});
