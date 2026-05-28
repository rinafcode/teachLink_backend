import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLoggerService } from '../audit-logger.service';
import { AuditLog } from '../../audit-log.entity';
import { AuditAction, AuditSeverity, AuditCategory } from '../../enums/audit-action.enum';
import { ConfigService } from '@nestjs/config';

describe('AuditLoggerService', () => {
  let service: AuditLoggerService;
  let repository: Repository<AuditLog>;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLoggerService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(365),
          },
        },
      ],
    }).compile();

    service = module.get<AuditLoggerService>(AuditLoggerService);
    repository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create and save an audit log entry', async () => {
      const entry = {
        userId: 'user-123',
        action: AuditAction.USER_CREATED,
        category: AuditCategory.DATA_MODIFICATION,
      };

      const mockLog = { ...entry, id: 'log-123', timestamp: new Date() };
      jest.spyOn(repository, 'create').mockReturnValue(mockLog as AuditLog);
      jest.spyOn(repository, 'save').mockResolvedValue(mockLog as AuditLog);

      const result = await service.log(entry);

      expect(result).toEqual(mockLog);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...entry,
          severity: AuditSeverity.INFO,
        }),
      );
      expect(repository.save).toHaveBeenCalled();
    });

    it('should handle save errors gracefully', async () => {
      const entry = {
        userId: 'user-123',
        action: AuditAction.USER_CREATED,
        category: AuditCategory.DATA_MODIFICATION,
      };

      const mockLog = { ...entry } as AuditLog;
      jest.spyOn(repository, 'create').mockReturnValue(mockLog);
      jest.spyOn(repository, 'save').mockRejectedValue(new Error('DB error'));

      const result = await service.log(entry);
      expect(result).toEqual(mockLog);
    });
  });

  describe('logAuth', () => {
    it('should log authentication event with correct category', async () => {
      const mockLog = { id: 'log-123' } as AuditLog;
      jest.spyOn(repository, 'create').mockReturnValue(mockLog);
      jest.spyOn(repository, 'save').mockResolvedValue(mockLog);

      await service.logAuth(
        AuditAction.LOGIN_SUCCESS,
        'user-123',
        'user@example.com',
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGIN_SUCCESS,
          category: AuditCategory.AUTHENTICATION,
          userId: 'user-123',
          userEmail: 'user@example.com',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      );
    });
  });

  describe('logDataChange', () => {
    it('should log data change with old and new values', async () => {
      const mockLog = { id: 'log-123' } as AuditLog;
      jest.spyOn(repository, 'create').mockReturnValue(mockLog);
      jest.spyOn(repository, 'save').mockResolvedValue(mockLog);

      const oldValues = { status: 'active' };
      const newValues = { status: 'inactive' };

      await service.logDataChange(
        AuditAction.USER_UPDATED,
        'user-123',
        'user@example.com',
        'User',
        'entity-456',
        oldValues,
        newValues,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_UPDATED,
          category: AuditCategory.DATA_MODIFICATION,
          entityType: 'User',
          entityId: 'entity-456',
          oldValues,
          newValues,
        }),
      );
    });
  });

  describe('logApiAccess', () => {
    it('should log API access with correct severity based on status code', async () => {
      const mockLog = { id: 'log-123' } as AuditLog;
      jest.spyOn(repository, 'create').mockReturnValue(mockLog);
      jest.spyOn(repository, 'save').mockResolvedValue(mockLog);

      await service.logApiAccess(
        'user-123',
        'user@example.com',
        '/api/users',
        'GET',
        200,
        50,
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.API_CALLED,
          category: AuditCategory.DATA_ACCESS,
          severity: AuditSeverity.INFO,
        }),
      );
    });

    it('should set severity to WARNING for 4xx errors', async () => {
      const mockLog = { id: 'log-123' } as AuditLog;
      jest.spyOn(repository, 'create').mockReturnValue(mockLog);
      jest.spyOn(repository, 'save').mockResolvedValue(mockLog);

      await service.logApiAccess(
        'user-123',
        'user@example.com',
        '/api/users',
        'GET',
        404,
        50,
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: AuditSeverity.WARNING,
        }),
      );
    });

    it('should set severity to ERROR for 5xx errors', async () => {
      const mockLog = { id: 'log-123' } as AuditLog;
      jest.spyOn(repository, 'create').mockReturnValue(mockLog);
      jest.spyOn(repository, 'save').mockResolvedValue(mockLog);

      await service.logApiAccess(
        'user-123',
        'user@example.com',
        '/api/users',
        'GET',
        500,
        50,
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: AuditSeverity.ERROR,
        }),
      );
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event with WARNING severity', async () => {
      const mockLog = { id: 'log-123' } as AuditLog;
      jest.spyOn(repository, 'create').mockReturnValue(mockLog);
      jest.spyOn(repository, 'save').mockResolvedValue(mockLog);

      await service.logSecurityEvent(
        AuditAction.FAILED_LOGIN_ATTEMPT,
        'user-123',
        'user@example.com',
        '192.168.1.1',
        'Mozilla/5.0',
        'Multiple failed login attempts detected',
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.FAILED_LOGIN_ATTEMPT,
          category: AuditCategory.SECURITY,
          severity: AuditSeverity.WARNING,
        }),
      );
    });
  });

  describe('applyRetentionPolicy', () => {
    it('should delete old logs based on retention policy', async () => {
      const mockResult = { affected: 100 };
      const mockQueryBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockResult),
      };

      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.applyRetentionPolicy();

      expect(result).toBe(100);
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });
  });
});
