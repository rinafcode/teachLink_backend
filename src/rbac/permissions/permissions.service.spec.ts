import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { Permission } from '../entities/permission.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';

const mockPermission: Permission = {
  id: 'perm-1',
  resource: 'courses',
  action: 'read',
  description: 'Read courses',
} as Permission;

const mockAuditLog = { id: 'audit-1' } as any;

describe('PermissionsService', () => {
  let service: PermissionsService;
  let permRepo: any;
  let auditLogService: AuditLogService;

  beforeEach(async () => {
    permRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: getRepositoryToken(Permission), useValue: permRepo },
        {
          provide: AuditLogService,
          useValue: { log: jest.fn().mockResolvedValue(mockAuditLog) },
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── createPermission ───────────────────────────────────────────────────────

  describe('createPermission', () => {
    it('should create a permission and emit RBAC_PERMISSION_CREATED audit log', async () => {
      permRepo.create.mockReturnValue(mockPermission);
      permRepo.save.mockResolvedValue(mockPermission);

      await service.createPermission('courses', 'read', 'Read courses', 'actor-1');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RBAC_PERMISSION_CREATED,
          category: AuditCategory.AUTHORIZATION,
          severity: AuditSeverity.INFO,
          userId: 'actor-1',
          entityType: 'Permission',
          entityId: mockPermission.id,
        }),
      );
    });

    it('should still create a permission without an actorId', async () => {
      permRepo.create.mockReturnValue(mockPermission);
      permRepo.save.mockResolvedValue(mockPermission);

      const result = await service.createPermission('courses', 'read');

      expect(result).toEqual(mockPermission);
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.RBAC_PERMISSION_CREATED }),
      );
    });
  });

  // ── updatePermission ───────────────────────────────────────────────────────

  describe('updatePermission', () => {
    it('should update a permission and emit RBAC_PERMISSION_UPDATED audit log', async () => {
      permRepo.findOneBy
        .mockResolvedValueOnce(mockPermission) // initial fetch for oldValues
        .mockResolvedValueOnce({ ...mockPermission, action: 'write' }); // post-update fetch
      permRepo.update.mockResolvedValue({ affected: 1 });

      await service.updatePermission('perm-1', 'courses', 'write', undefined, 'actor-1');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RBAC_PERMISSION_UPDATED,
          category: AuditCategory.AUTHORIZATION,
          severity: AuditSeverity.INFO,
          userId: 'actor-1',
          entityType: 'Permission',
          entityId: 'perm-1',
          oldValues: expect.objectContaining({ action: 'read' }),
          newValues: expect.objectContaining({ action: 'write' }),
        }),
      );
    });

    it('should throw NotFoundException when permission does not exist', async () => {
      permRepo.findOneBy.mockResolvedValue(null);

      await expect(service.updatePermission('missing', 'x', 'y')).rejects.toThrow(
        NotFoundException,
      );
      expect(auditLogService.log).not.toHaveBeenCalled();
    });
  });

  // ── deletePermission ───────────────────────────────────────────────────────

  describe('deletePermission', () => {
    it('should delete a permission and emit RBAC_PERMISSION_DELETED audit log', async () => {
      permRepo.findOneBy.mockResolvedValue(mockPermission);
      permRepo.delete.mockResolvedValue({ affected: 1 });

      await service.deletePermission('perm-1', 'actor-1');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.RBAC_PERMISSION_DELETED,
          category: AuditCategory.AUTHORIZATION,
          severity: AuditSeverity.WARNING,
          userId: 'actor-1',
          entityType: 'Permission',
          entityId: 'perm-1',
        }),
      );
    });

    it('should throw NotFoundException when permission does not exist', async () => {
      permRepo.findOneBy.mockResolvedValue(null);

      await expect(service.deletePermission('missing')).rejects.toThrow(NotFoundException);
      expect(auditLogService.log).not.toHaveBeenCalled();
    });
  });
});
