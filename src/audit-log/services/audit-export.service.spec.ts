import { Test, TestingModule } from '@nestjs/testing';
import { AuditExportService } from './audit-export.service';
import { AuditQueryService } from './audit-query.service';

describe('AuditExportService', () => {
  let service: AuditExportService;
  let queryService: { search: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditExportService,
        { provide: AuditQueryService, useValue: { search: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuditExportService>(AuditExportService);
    queryService = module.get(AuditQueryService);
  });

  describe('exportToJson', () => {
    it('queries with the given filters and returns pretty-printed JSON', async () => {
      const logs = [{ id: '1', action: 'LOGIN' }];
      queryService.search.mockResolvedValue({ data: logs, total: 1 });

      const result = await service.exportToJson({ userId: 'u1' } as any);

      expect(queryService.search).toHaveBeenCalledWith({ userId: 'u1' }, 1, 10000);
      expect(JSON.parse(result)).toEqual(logs);
      expect(result).toContain('\n'); // pretty-printed, not minified
    });

    it('returns an empty array literal when there are no matching logs', async () => {
      queryService.search.mockResolvedValue({ data: [], total: 0 });

      const result = await service.exportToJson({} as any);

      expect(result).toBe('[]');
    });

    it('propagates a query failure', async () => {
      const error = new Error('query failed');
      queryService.search.mockRejectedValue(error);

      await expect(service.exportToJson({} as any)).rejects.toThrow(error);
    });
  });

  describe('exportToCsv', () => {
    it('emits a header row followed by one row per log', async () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z');
      queryService.search.mockResolvedValue({
        data: [
          {
            timestamp,
            userId: 'u1',
            userEmail: 'u1@example.com',
            action: 'LOGIN',
            category: 'auth',
            severity: 'info',
            entityType: 'user',
            entityId: 'u1',
            description: 'User logged in',
            ipAddress: '127.0.0.1',
            userAgent: 'jest',
            apiEndpoint: '/login',
            httpMethod: 'POST',
            statusCode: 200,
          },
        ],
      });

      const result = await service.exportToCsv({} as any);
      const lines = result.split('\n');

      expect(lines[0]).toBe(
        'timestamp,userId,userEmail,action,category,severity,entityType,entityId,description,ipAddress,userAgent,apiEndpoint,httpMethod,statusCode',
      );
      expect(lines[1]).toBe(
        `${timestamp.toISOString()},u1,u1@example.com,LOGIN,auth,info,user,u1,User logged in,127.0.0.1,jest,/login,POST,200`,
      );
    });

    it('substitutes empty strings for missing optional fields', async () => {
      queryService.search.mockResolvedValue({
        data: [
          {
            timestamp: new Date('2026-01-01T00:00:00.000Z'),
            action: 'LOGIN',
            category: 'auth',
            severity: 'info',
          },
        ],
      });

      const result = await service.exportToCsv({} as any);
      const dataLine = result.split('\n')[1];

      // userId, userEmail, entityType, entityId, description, ipAddress,
      // userAgent, apiEndpoint, httpMethod, statusCode all fall back to ''.
      expect(dataLine).toBe(
        `${new Date('2026-01-01T00:00:00.000Z').toISOString()},,,LOGIN,auth,info,,,,,,,,`,
      );
    });

    it('quotes and escapes fields containing commas, quotes, or newlines', async () => {
      queryService.search.mockResolvedValue({
        data: [
          {
            timestamp: new Date('2026-01-01T00:00:00.000Z'),
            action: 'LOGIN',
            category: 'auth',
            severity: 'info',
            description: 'Said "hello", then\nleft',
          },
        ],
      });

      const result = await service.exportToCsv({} as any);
      expect(result).toContain('"Said ""hello"", then\nleft"');
    });

    it('returns just the header row when there are no matching logs', async () => {
      queryService.search.mockResolvedValue({ data: [] });

      const result = await service.exportToCsv({} as any);

      expect(result.split('\n')).toHaveLength(1);
      expect(result).toContain('timestamp,userId');
    });

    it('propagates a query failure', async () => {
      const error = new Error('query failed');
      queryService.search.mockRejectedValue(error);

      await expect(service.exportToCsv({} as any)).rejects.toThrow(error);
    });
  });
});
