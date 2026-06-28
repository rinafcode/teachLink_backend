import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';

const mockRole: Role = {
  id: 'role-1',
  name: 'admin',
  description: 'Administrator role',
  permissions: [],
} as Role;

const mockPermission: Permission = {
  id: 'perm-1',
  resource: 'courses',
  action: 'read',
  description: 'Read courses',
} as Permission;

const mockAuditLog = { id: 'audit-1' } as any;

describe('RolesService', () => {
  let service: RolesService;
  let roleRepo: any;
  let permRepo: any;
  let auditLogService: AuditLogService;

  beforeEach(async () => {
    const queryBuilderMock = {
      relation: jest.fn().mockReturnThis(),
      of: jest.fn().mockReturnThis(),
      set: jest.fn().mockResolvedValue(undefined),
    };

    roleRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findByIds: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
    };

    permRepo = {
      findByIds: jest.fn(),
      findOneBy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: getRepositoryToken(Permission), useValue: permRepo },
        {
          provide: AuditLogService,
          useValue: { log: jest.fn().mockResolvedValue(mockAuditLog) },
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── createRole ─────────────────────────────────────────────────────────────

  describe('createRole', () => {
    it('should create a role and emit RBAC_ROLE_CREATED audit log', async () => {
      roleRepo.create.mockReturnValue(mockRole);
      roleRepo.save.mockResolvedValue(mockRole);

      await service.createRole('admin', 'Administrator role', [], 'actor-1');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RBAC_ROLE_CREATED,
          category: AuditCategory.AUTHORIZATION,
          severity: AuditSeverity.INFO,
          userId: 'actor-1',
          entityType: 'Role',
          entityId: mockRole.id,
        }),
      );
    });

    it('should still create a role without an actorId', async () => {
      roleRepo.create.mockReturnValue(mockRole);
      roleRepo.save.mockResolvedValue(mockRole);

      const result = await service.createRole('admin');

      expect(result).toEqual(mockRole);
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.RBAC_ROLE_CREATED }),
      );
    });
  });

  // ── updateRole ─────────────────────────────────────────────────────────────

  describe('updateRole', () => {
    it('should update a role and emit RBAC_ROLE_UPDATED audit log', async () => {
      roleRepo.findOne
        .mockResolvedValueOnce({ ...mockRole, permissions: [] }) // initial fetch for oldValues
        .mockResolvedValueOnce({ ...mockRole, name: 'superadmin' }); // post-update fetch
      roleRepo.update.mockResolvedValue({ affected: 1 });

      await service.updateRole('role-1', 'superadmin', undefined, undefined, 'actor-1');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RBAC_ROLE_UPDATED,
          category: AuditCategory.AUTHORIZATION,
          severity: AuditSeverity.INFO,
          userId: 'actor-1',
          entityType: 'Role',
          entityId: 'role-1',
        }),
      );
    });

    it('should throw NotFoundException when role does not exist', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      await expect(service.updateRole('missing', 'x')).rejects.toThrow(NotFoundException);
      expect(auditLogService.log).not.toHaveBeenCalled();
    });
  });

  // ── deleteRole ─────────────────────────────────────────────────────────────

  describe('deleteRole', () => {
    it('should delete a role and emit RBAC_ROLE_DELETED audit log', async () => {
      roleRepo.findOne.mockResolvedValue(mockRole);
      roleRepo.delete.mockResolvedValue({ affected: 1 });

      await service.deleteRole('role-1', 'actor-1');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RBAC_ROLE_DELETED,
          category: AuditCategory.AUTHORIZATION,
          severity: AuditSeverity.WARNING,
          userId: 'actor-1',
          entityType: 'Role',
          entityId: 'role-1',
        }),
      );
    });

    it('should throw NotFoundException when role does not exist', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteRole('missing')).rejects.toThrow(NotFoundException);
      expect(auditLogService.log).not.toHaveBeenCalled();
    });
  });

  // ── addPermissionToRole ────────────────────────────────────────────────────

  describe('addPermissionToRole', () => {
    it('should grant a permission to a role and emit RBAC_PERMISSION_GRANTED audit log', async () => {
      roleRepo.findOne.mockResolvedValue({ ...mockRole, permissions: [] });
      permRepo.findOneBy.mockResolvedValue(mockPermission);
      roleRepo.save.mockResolvedValue({ ...mockRole, permissions: [mockPermission] });

      await service.addPermissionToRole('role-1', 'perm-1', 'actor-1');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RBAC_PERMISSION_GRANTED,
          category: AuditCategory.AUTHORIZATION,
          severity: AuditSeverity.INFO,
          userId: 'actor-1',
          entityType: 'Role',
          entityId: 'role-1',
        }),
      );
    });

    it('should NOT emit audit log when permission already assigned', async () => {
      roleRepo.findOne.mockResolvedValue({ ...mockRole, permissions: [mockPermission] });
      permRepo.findOneBy.mockResolvedValue(mockPermission);

      await service.addPermissionToRole('role-1', 'perm-1', 'actor-1');

      expect(auditLogService.log).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when role does not exist', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      await expect(service.addPermissionToRole('missing', 'perm-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(auditLogService.log).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when permission does not exist', async () => {
      roleRepo.findOne.mockResolvedValue({ ...mockRole, permissions: [] });
      permRepo.findOneBy.mockResolvedValue(null);

      await expect(service.addPermissionToRole('role-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(auditLogService.log).not.toHaveBeenCalled();
    });
  });

  // ── removePermissionFromRole ───────────────────────────────────────────────

  describe('removePermissionFromRole', () => {
    it('should revoke a permission from a role and emit RBAC_PERMISSION_REVOKED audit log', async () => {
      roleRepo.findOne.mockResolvedValue({ ...mockRole, permissions: [mockPermission] });
      roleRepo.save.mockResolvedValue({ ...mockRole, permissions: [] });

      await service.removePermissionFromRole('role-1', 'perm-1', 'actor-1');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RBAC_PERMISSION_REVOKED,
          category: AuditCategory.AUTHORIZATION,
          severity: AuditSeverity.WARNING,
          userId: 'actor-1',
          entityType: 'Role',
          entityId: 'role-1',
        }),
      );
    });

    it('should throw NotFoundException when role does not exist', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      await expect(service.removePermissionFromRole('missing', 'perm-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(auditLogService.log).not.toHaveBeenCalled();
    });
  });
});
