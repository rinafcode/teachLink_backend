import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditReportingService } from './audit-reporting.service';
import { AuditLog } from '../audit-log.entity';
import { AuditSeverity } from '../enums/audit-action.enum';

const makeQb = (overrides: Record<string, jest.Mock> = {}) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  addGroupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  getCount: jest.fn().mockResolvedValue(0),
  getRawMany: jest.fn().mockResolvedValue([]),
  ...overrides,
});

describe('AuditReportingService', () => {
  let service: AuditReportingService;
  let mockRepo: {
    createQueryBuilder: jest.Mock;
    count: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      createQueryBuilder: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditReportingService,
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<AuditReportingService>(AuditReportingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── generateReport ─────────────────────────────────────────────────────────

  describe('generateReport', () => {
    it('returns a report with correct period and zero totals when repo returns nothing', async () => {
      mockRepo.createQueryBuilder.mockReturnValue(makeQb());

      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      const report = await service.generateReport(start, end);

      expect(report.period.start).toBe(start);
      expect(report.period.end).toBe(end);
      expect(report.totalEvents).toBe(0);
      expect(report.eventsByCategory).toEqual({});
      expect(report.eventsByAction).toEqual({});
      expect(report.eventsBySeverity).toEqual({});
      expect(report.topUsers).toEqual([]);
      expect(report.topEndpoints).toEqual([]);
      expect(report.failedActions).toEqual([]);
    });

    it('aggregates category, action and severity stats correctly', async () => {
      let callCount = 0;
      mockRepo.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // total count query
          return makeQb({ getCount: jest.fn().mockResolvedValue(3) });
        }
        if (callCount === 2) {
          // category stats
          return makeQb({
            getRawMany: jest.fn().mockResolvedValue([{ category: 'AUTHENTICATION', count: '2' }]),
          });
        }
        if (callCount === 3) {
          // action stats
          return makeQb({
            getRawMany: jest.fn().mockResolvedValue([{ action: 'LOGIN', count: '1' }]),
          });
        }
        if (callCount === 4) {
          // severity stats
          return makeQb({
            getRawMany: jest.fn().mockResolvedValue([{ severity: 'INFO', count: '3' }]),
          });
        }
        // top users, top endpoints, failed actions
        return makeQb();
      });

      const report = await service.generateReport(new Date(), new Date());

      expect(report.totalEvents).toBe(3);
      expect(report.eventsByCategory).toEqual({ AUTHENTICATION: 2 });
      expect(report.eventsByAction).toEqual({ LOGIN: 1 });
      expect(report.eventsBySeverity).toEqual({ INFO: 3 });
    });

    it('maps top users with integer counts', async () => {
      let callCount = 0;
      mockRepo.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 5) {
          // top users query (5th query builder call)
          return makeQb({
            getRawMany: jest
              .fn()
              .mockResolvedValue([{ userId: 'u1', userEmail: 'u@x.com', count: '10' }]),
          });
        }
        return makeQb();
      });

      const report = await service.generateReport(new Date(), new Date());
      expect(report.topUsers[0]).toEqual({ userId: 'u1', userEmail: 'u@x.com', count: 10 });
    });

    it('uses "Unknown" as fallback when userEmail is null', async () => {
      let callCount = 0;
      mockRepo.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 5) {
          return makeQb({
            getRawMany: jest
              .fn()
              .mockResolvedValue([{ userId: 'u2', userEmail: null, count: '1' }]),
          });
        }
        return makeQb();
      });

      const report = await service.generateReport(new Date(), new Date());
      expect(report.topUsers[0].userEmail).toBe('Unknown');
    });
  });

  // ── getStatistics ──────────────────────────────────────────────────────────

  describe('getStatistics', () => {
    it('returns all counters from parallel count queries', async () => {
      mockRepo.count
        .mockResolvedValueOnce(500) // totalLogs
        .mockResolvedValueOnce(10) // logsToday
        .mockResolvedValueOnce(50) // logsThisWeek
        .mockResolvedValueOnce(200) // logsThisMonth
        .mockResolvedValueOnce(3) // criticalEvents
        .mockResolvedValueOnce(7); // errorEvents

      const stats = await service.getStatistics();

      expect(stats).toEqual({
        totalLogs: 500,
        logsToday: 10,
        logsThisWeek: 50,
        logsThisMonth: 200,
        criticalEvents: 3,
        errorEvents: 7,
      });
    });

    it('calls count with CRITICAL severity for criticalEvents', async () => {
      mockRepo.count.mockResolvedValue(0);

      await service.getStatistics();

      const calls = mockRepo.count.mock.calls;
      // 5th call (index 4) should filter by CRITICAL
      expect(calls[4][0]).toMatchObject({ where: { severity: AuditSeverity.CRITICAL } });
      // 6th call (index 5) should filter by ERROR
      expect(calls[5][0]).toMatchObject({ where: { severity: AuditSeverity.ERROR } });
    });
  });
});
