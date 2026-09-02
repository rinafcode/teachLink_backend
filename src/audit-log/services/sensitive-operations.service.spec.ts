import { Test, TestingModule } from '@nestjs/testing';
import { SensitiveOperationsService } from './sensitive-operations.service';
import { AuditLogService } from '../audit-log.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../enums/audit-action.enum';

describe('SensitiveOperationsService', () => {
  let service: SensitiveOperationsService;
  let auditLogService: { log: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SensitiveOperationsService,
        { provide: AuditLogService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<SensitiveOperationsService>(SensitiveOperationsService);
    auditLogService = module.get(AuditLogService);
  });

  describe('logSensitiveOperation', () => {
    const baseOperation = {
      userId: 'u1',
      userEmail: 'u1@example.com',
      action: AuditAction.USER_DELETED,
      entityType: 'User',
      entityId: 'u2',
      description: 'deleted',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    };

    it('logs with WARNING severity, a resolved category, and the sensitive-operation flag', async () => {
      await service.logSensitiveOperation(baseOperation);

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          action: AuditAction.USER_DELETED,
          category: AuditCategory.AUTHORIZATION,
          severity: AuditSeverity.WARNING,
          metadata: expect.objectContaining({ isSensitiveOperation: true }),
        }),
      );
    });

    it('falls back to the SYSTEM category for an action with no explicit mapping', async () => {
      await service.logSensitiveOperation({
        ...baseOperation,
        action: 'UNMAPPED_ACTION' as AuditAction,
      });

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ category: AuditCategory.SYSTEM }),
      );
    });

    it('logs the error and rethrows when the underlying audit log write fails', async () => {
      const error = new Error('write failed');
      auditLogService.log.mockRejectedValue(error);

      await expect(service.logSensitiveOperation(baseOperation)).rejects.toThrow(error);
    });
  });

  describe('logUserDeletion', () => {
    it('delegates to logSensitiveOperation with a USER_DELETED entry', async () => {
      await service.logUserDeletion('u1', 'admin@x.com', 'u2', 'victim@x.com', '1.2.3.4', 'ua');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_DELETED,
          entityType: 'User',
          entityId: 'u2',
          description: expect.stringContaining('victim@x.com'),
        }),
      );
    });
  });

  describe('logRoleChange', () => {
    it('records the old and new role in oldValues/newValues', async () => {
      await service.logRoleChange(
        'u1',
        'admin@x.com',
        'u2',
        'target@x.com',
        'student',
        'instructor',
        '1.2.3.4',
        'ua',
      );

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_ROLE_CHANGED,
          oldValues: { role: 'student' },
          newValues: { role: 'instructor' },
        }),
      );
    });
  });

  describe('logPasswordChange', () => {
    it('logs a PASSWORD_CHANGE entry scoped to the user themselves', async () => {
      await service.logPasswordChange('u1', 'u1@example.com', '1.2.3.4', 'ua');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.PASSWORD_CHANGE,
          entityId: 'u1',
        }),
      );
    });
  });

  describe('logConfigChange', () => {
    it('logs directly with CRITICAL severity and the old/new config values', async () => {
      await service.logConfigChange(
        'u1',
        'admin@x.com',
        'feature.flag',
        false,
        true,
        '1.2.3.4',
        'ua',
      );

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CONFIG_CHANGED,
          category: AuditCategory.SYSTEM,
          severity: AuditSeverity.CRITICAL,
          oldValues: { value: false },
          newValues: { value: true },
        }),
      );
    });

    it('propagates a failure from the underlying audit log write', async () => {
      const error = new Error('write failed');
      auditLogService.log.mockRejectedValue(error);

      await expect(
        service.logConfigChange('u1', 'a@x.com', 'k', 1, 2, '1.2.3.4', 'ua'),
      ).rejects.toThrow(error);
    });
  });

  describe('logDataExport', () => {
    it('describes the export and includes record count/format in metadata', async () => {
      await service.logDataExport('u1', 'u1@x.com', 'User', 42, 'csv', '1.2.3.4', 'ua');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.DATA_EXPORTED,
          description: expect.stringContaining('42'),
          metadata: expect.objectContaining({ recordCount: 42, exportFormat: 'csv' }),
        }),
      );
    });
  });

  describe('logBackupOperation', () => {
    it('maps CREATE to BACKUP_CREATED', async () => {
      await service.logBackupOperation('u1', 'a@x.com', 'CREATE', 'backup-1', '1.2.3.4', 'ua');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.BACKUP_CREATED, entityId: 'backup-1' }),
      );
    });

    it('maps RESTORE to BACKUP_RESTORED', async () => {
      await service.logBackupOperation('u1', 'a@x.com', 'RESTORE', 'backup-1', '1.2.3.4', 'ua');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.BACKUP_RESTORED }),
      );
    });
  });

  describe('logPermissionDenied', () => {
    it('logs with SECURITY category and WARNING severity', async () => {
      await service.logPermissionDenied('u1', 'u1@x.com', 'Course', 'delete', '1.2.3.4', 'ua');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.PERMISSION_DENIED,
          category: AuditCategory.SECURITY,
          severity: AuditSeverity.WARNING,
        }),
      );
    });

    it('converts a null userId/userEmail to undefined for anonymous attempts', async () => {
      await service.logPermissionDenied(null, null, 'Course', 'delete', '1.2.3.4', 'ua');

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: undefined, userEmail: undefined }),
      );
    });
  });

  describe('logSuspiciousActivity', () => {
    it('logs with SECURITY category and CRITICAL severity, merging extra metadata', async () => {
      await service.logSuspiciousActivity(
        'u1',
        'u1@x.com',
        'brute-force',
        'multiple failed logins',
        '1.2.3.4',
        'ua',
        undefined,
        { attempts: 5 },
      );

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SUSPICIOUS_ACTIVITY,
          category: AuditCategory.SECURITY,
          severity: AuditSeverity.CRITICAL,
          metadata: expect.objectContaining({ activityType: 'brute-force', attempts: 5 }),
        }),
      );
    });

    it('supports an anonymous actor', async () => {
      await service.logSuspiciousActivity(
        null,
        null,
        'scraping',
        'unusual request pattern',
        '1.2.3.4',
        'ua',
      );

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: undefined, userEmail: undefined }),
      );
    });
  });
});
