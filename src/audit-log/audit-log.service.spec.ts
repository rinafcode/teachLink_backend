import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { AuditLoggerService } from './services/audit-logger.service';
import { AuditQueryService } from './services/audit-query.service';
import { AuditReportingService } from './services/audit-reporting.service';
import { AuditExportService } from './services/audit-export.service';
import { AuditAction, AuditSeverity, AuditCategory } from './enums/audit-action.enum';
import { AuditLog, HttpMethod } from './audit-log.entity';
import { IAuditLogSearchResult, IAuditReport } from './interfaces/audit-log.interfaces';

const mockLog = { id: 'log-1', action: AuditAction.LOGIN } as AuditLog;

const mockLoggerService = {
  log: jest.fn().mockResolvedValue(mockLog),
  logAuth: jest.fn().mockResolvedValue(mockLog),
  logDataChange: jest.fn().mockResolvedValue(mockLog),
  logApiAccess: jest.fn().mockResolvedValue(mockLog),
  logSecurityEvent: jest.fn().mockResolvedValue(mockLog),
  applyRetentionPolicy: jest.fn().mockResolvedValue(42),
};

const mockQueryService = {
  search: jest.fn(),
  findAll: jest.fn().mockResolvedValue([mockLog]),
  findByUser: jest.fn().mockResolvedValue([mockLog]),
  findByAction: jest.fn().mockResolvedValue([mockLog]),
  findByEntity: jest.fn().mockResolvedValue([mockLog]),
  findByIpAddress: jest.fn().mockResolvedValue([mockLog]),
  findByDateRange: jest.fn().mockResolvedValue([mockLog]),
};

const mockReportingService = {
  generateReport: jest.fn(),
  getStatistics: jest.fn(),
};

const mockExportService = {
  exportToJson: jest.fn().mockResolvedValue('[]'),
  exportToCsv: jest.fn().mockResolvedValue(''),
};

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: AuditLoggerService, useValue: mockLoggerService },
        { provide: AuditQueryService, useValue: mockQueryService },
        { provide: AuditReportingService, useValue: mockReportingService },
        { provide: AuditExportService, useValue: mockExportService },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Write ──────────────────────────────────────────────────────────────────

  describe('log', () => {
    it('delegates to loggerService.log and returns result', async () => {
      const entry = {
        action: AuditAction.USER_CREATED,
        category: AuditCategory.DATA_MODIFICATION,
      };
      const result = await service.log(entry);
      expect(mockLoggerService.log).toHaveBeenCalledWith(entry);
      expect(result).toBe(mockLog);
    });
  });

  describe('logAuth', () => {
    it('passes all options to loggerService.logAuth', async () => {
      await service.logAuth({
        action: AuditAction.LOGIN,
        userId: 'u1',
        userEmail: 'u@x.com',
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      });
      expect(mockLoggerService.logAuth).toHaveBeenCalledWith(
        AuditAction.LOGIN,
        'u1',
        'u@x.com',
        '1.2.3.4',
        'jest',
        undefined,
        AuditSeverity.INFO,
      );
    });

    it('uses provided severity instead of default INFO', async () => {
      await service.logAuth({
        action: AuditAction.LOGIN_FAILED,
        userId: null,
        userEmail: null,
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
        severity: AuditSeverity.WARNING,
      });
      expect(mockLoggerService.logAuth).toHaveBeenCalledWith(
        AuditAction.LOGIN_FAILED,
        null,
        null,
        '1.2.3.4',
        'jest',
        undefined,
        AuditSeverity.WARNING,
      );
    });
  });

  describe('logDataChange', () => {
    it('passes all options to loggerService.logDataChange', async () => {
      await service.logDataChange({
        action: AuditAction.USER_UPDATED,
        userId: 'u1',
        userEmail: 'u@x.com',
        entityType: 'User',
        entityId: 'e1',
        oldValues: { name: 'old' },
        newValues: { name: 'new' },
      });
      expect(mockLoggerService.logDataChange).toHaveBeenCalledWith(
        AuditAction.USER_UPDATED,
        'u1',
        'u@x.com',
        'User',
        'e1',
        { name: 'old' },
        { name: 'new' },
        undefined,
        undefined,
      );
    });
  });

  describe('logApiAccess', () => {
    it('passes all options to loggerService.logApiAccess', async () => {
      await service.logApiAccess({
        userId: 'u1',
        userEmail: 'u@x.com',
        apiEndpoint: '/v1/users',
        httpMethod: HttpMethod.GET,
        statusCode: 200,
        responseTimeMs: 50,
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      });
      expect(mockLoggerService.logApiAccess).toHaveBeenCalledWith(
        'u1',
        'u@x.com',
        '/v1/users',
        HttpMethod.GET,
        200,
        50,
        '1.2.3.4',
        'jest',
        undefined,
      );
    });
  });

  describe('logSecurityEvent', () => {
    it('passes all options to loggerService.logSecurityEvent', async () => {
      await service.logSecurityEvent({
        action: AuditAction.SUSPICIOUS_ACTIVITY,
        userId: null,
        userEmail: null,
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
        description: 'brute force',
      });
      expect(mockLoggerService.logSecurityEvent).toHaveBeenCalledWith(
        AuditAction.SUSPICIOUS_ACTIVITY,
        null,
        null,
        '1.2.3.4',
        'jest',
        'brute force',
        undefined,
      );
    });
  });

  // ── Query ──────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('delegates to queryService.search with defaults', async () => {
      const result: IAuditLogSearchResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      };
      mockQueryService.search.mockResolvedValue(result);
      const filters = { userId: 'u1' };
      const out = await service.search(filters);
      expect(mockQueryService.search).toHaveBeenCalledWith(filters, 1, 50, undefined, undefined);
      expect(out).toBe(result);
    });
  });

  describe('findAll', () => {
    it('delegates to queryService.findAll', async () => {
      const out = await service.findAll(10);
      expect(mockQueryService.findAll).toHaveBeenCalledWith(10);
      expect(out).toEqual([mockLog]);
    });
  });

  describe('findByUser', () => {
    it('delegates to queryService.findByUser', async () => {
      await service.findByUser('u1', 5);
      expect(mockQueryService.findByUser).toHaveBeenCalledWith('u1', 5);
    });
  });

  describe('findByAction', () => {
    it('delegates to queryService.findByAction', async () => {
      await service.findByAction(AuditAction.LOGIN);
      expect(mockQueryService.findByAction).toHaveBeenCalledWith(AuditAction.LOGIN, 100);
    });
  });

  describe('findByEntity', () => {
    it('delegates to queryService.findByEntity', async () => {
      await service.findByEntity('User', 'e1');
      expect(mockQueryService.findByEntity).toHaveBeenCalledWith('User', 'e1', 100);
    });
  });

  describe('findByIpAddress', () => {
    it('delegates to queryService.findByIpAddress', async () => {
      await service.findByIpAddress('1.2.3.4');
      expect(mockQueryService.findByIpAddress).toHaveBeenCalledWith('1.2.3.4', 100);
    });
  });

  describe('findByDateRange', () => {
    it('delegates to queryService.findByDateRange', async () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      await service.findByDateRange(start, end);
      expect(mockQueryService.findByDateRange).toHaveBeenCalledWith(start, end, 1000);
    });
  });

  // ── Reporting ──────────────────────────────────────────────────────────────

  describe('generateReport', () => {
    it('delegates to reportingService.generateReport', async () => {
      const report: IAuditReport = {
        period: { start: new Date(), end: new Date() },
        totalEvents: 0,
        eventsByCategory: {},
        eventsByAction: {},
        eventsBySeverity: {},
        topUsers: [],
        topEndpoints: [],
        failedActions: [],
      };
      mockReportingService.generateReport.mockResolvedValue(report);
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const out = await service.generateReport(start, end);
      expect(mockReportingService.generateReport).toHaveBeenCalledWith(start, end);
      expect(out).toBe(report);
    });
  });

  describe('getStatistics', () => {
    it('delegates to reportingService.getStatistics', async () => {
      const stats = {
        totalLogs: 100,
        logsToday: 5,
        logsThisWeek: 20,
        logsThisMonth: 80,
        criticalEvents: 1,
        errorEvents: 3,
      };
      mockReportingService.getStatistics.mockResolvedValue(stats);
      const out = await service.getStatistics();
      expect(mockReportingService.getStatistics).toHaveBeenCalled();
      expect(out).toBe(stats);
    });
  });

  // ── Maintenance ────────────────────────────────────────────────────────────

  describe('applyRetentionPolicy', () => {
    it('delegates to loggerService.applyRetentionPolicy and returns count', async () => {
      const out = await service.applyRetentionPolicy();
      expect(mockLoggerService.applyRetentionPolicy).toHaveBeenCalled();
      expect(out).toBe(42);
    });
  });

  // ── Export ─────────────────────────────────────────────────────────────────

  describe('exportToJson', () => {
    it('delegates to exportService.exportToJson', async () => {
      const filters = { userId: 'u1' };
      const out = await service.exportToJson(filters);
      expect(mockExportService.exportToJson).toHaveBeenCalledWith(filters);
      expect(out).toBe('[]');
    });
  });

  describe('exportToCsv', () => {
    it('delegates to exportService.exportToCsv', async () => {
      const filters = { userId: 'u1' };
      await service.exportToCsv(filters);
      expect(mockExportService.exportToCsv).toHaveBeenCalledWith(filters);
    });
  });
});
