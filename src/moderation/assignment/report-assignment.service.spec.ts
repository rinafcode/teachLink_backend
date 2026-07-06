import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '../../users/entities/user.entity';
import { ContentReport } from '../reports/content-report.entity';
import { ContentReportStatus } from '../reports/content-report-status.enum';
import { ContentReportReason } from '../reports/content-report-reason.enum';
import { NotificationsService } from '../../notifications/notifications.service';
import { ReportAssignmentService } from './report-assignment.service';

// ─── Mock factories ────────────────────────────────────────────────────────────

function makeUser(id: string, role: UserRole = UserRole.MODERATOR): User {
  return { id, roles: [{ name: role }] } as unknown as User;
}

function makeReport(id: string = 'r-1'): ContentReport {
  return {
    id,
    reason: ContentReportReason.SPAM,
    contentType: 'course',
    contentId: 'c-1',
    status: ContentReportStatus.PENDING,
    assignedModeratorId: undefined,
    escalatedAt: undefined,
    createdAt: new Date(),
  } as unknown as ContentReport;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUserRepo = {
  createQueryBuilder: jest.fn(),
};

const mockReportRepo = {
  save: jest.fn((r: ContentReport) => Promise.resolve(r)),
  find: jest.fn().mockResolvedValue([]),
};

const mockNotificationsService: jest.Mocked<Pick<NotificationsService, 'send'>> = {
  send: jest.fn().mockResolvedValue({}),
};

const mockConfigService = {
  get: jest.fn((key: string, fallback?: unknown) => fallback),
};

// ─── QueryBuilder helper ──────────────────────────────────────────────────────

function buildQb(users: User[]) {
  const qb: Record<string, jest.Mock> = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(users),
  };
  qb.innerJoin = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  return qb;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReportAssignmentService', () => {
  let service: ReportAssignmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportAssignmentService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(ContentReport), useValue: mockReportRepo },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(ReportAssignmentService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── assignReport ────────────────────────────────────────────────────────

  describe('assignReport', () => {
    it('assigns to the first available moderator', async () => {
      const moderator = makeUser('mod-1');
      mockUserRepo.createQueryBuilder.mockReturnValue(buildQb([moderator]));

      const report = makeReport();
      const result = await service.assignReport(report);

      expect(result.assignedModeratorId).toBe('mod-1');
      expect(result.status).toBe(ContentReportStatus.UNDER_REVIEW);
    });

    it('sends an assignment notification to the moderator', async () => {
      const moderator = makeUser('mod-1');
      mockUserRepo.createQueryBuilder.mockReturnValue(buildQb([moderator]));

      await service.assignReport(makeReport());

      expect(mockNotificationsService.send).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'mod-1' }),
      );
    });

    it('distributes reports round-robin across moderators', async () => {
      const mod1 = makeUser('mod-1');
      const mod2 = makeUser('mod-2');
      mockUserRepo.createQueryBuilder
        .mockReturnValueOnce(buildQb([mod1, mod2]))
        .mockReturnValueOnce(buildQb([mod1, mod2]));

      const r1 = await service.assignReport(makeReport('r-1'));
      const r2 = await service.assignReport(makeReport('r-2'));

      expect(r1.assignedModeratorId).toBe('mod-1');
      expect(r2.assignedModeratorId).toBe('mod-2');
    });

    it('does not throw and leaves report unassigned when no moderators exist', async () => {
      mockUserRepo.createQueryBuilder.mockReturnValue(buildQb([]));

      const report = makeReport();
      const result = await service.assignReport(report);

      expect(result.assignedModeratorId).toBeUndefined();
      expect(mockReportRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─── escalateReport ──────────────────────────────────────────────────────

  describe('escalateReport', () => {
    it('reassigns report to an admin and sets escalatedAt', async () => {
      const admin = makeUser('admin-1', UserRole.ADMIN);
      mockUserRepo.createQueryBuilder.mockReturnValue(buildQb([admin]));

      const report = makeReport();
      const result = await service.escalateReport(report);

      expect(result.assignedModeratorId).toBe('admin-1');
      expect(result.escalatedAt).toBeInstanceOf(Date);
    });

    it('sends an URGENT escalation notification to the admin', async () => {
      const admin = makeUser('admin-1', UserRole.ADMIN);
      mockUserRepo.createQueryBuilder.mockReturnValue(buildQb([admin]));

      await service.escalateReport(makeReport());

      expect(mockNotificationsService.send).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-1', priority: 'urgent' }),
      );
    });

    it('does not throw when no admins exist', async () => {
      mockUserRepo.createQueryBuilder.mockReturnValue(buildQb([]));

      const report = makeReport();
      const result = await service.escalateReport(report);

      expect(result.escalatedAt).toBeUndefined();
      expect(mockReportRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─── escalateOverdueReports ──────────────────────────────────────────────

  describe('escalateOverdueReports', () => {
    it('escalates overdue reports found by the repository', async () => {
      const overdueReport = makeReport('r-overdue');
      mockReportRepo.find.mockResolvedValueOnce([overdueReport]);

      const admin = makeUser('admin-1', UserRole.ADMIN);
      mockUserRepo.createQueryBuilder.mockReturnValue(buildQb([admin]));

      await service.escalateOverdueReports();

      expect(mockReportRepo.save).toHaveBeenCalled();
      expect(mockNotificationsService.send).toHaveBeenCalled();
    });

    it('does nothing when there are no overdue reports', async () => {
      mockReportRepo.find.mockResolvedValueOnce([]);

      await service.escalateOverdueReports();

      expect(mockReportRepo.save).not.toHaveBeenCalled();
      expect(mockNotificationsService.send).not.toHaveBeenCalled();
    });
  });

  // ─── notification failure isolation ─────────────────────────────────────

  describe('notification failure isolation', () => {
    it('does not throw when notification send fails during assignment', async () => {
      const moderator = makeUser('mod-1');
      mockUserRepo.createQueryBuilder.mockReturnValue(buildQb([moderator]));
      mockNotificationsService.send.mockRejectedValueOnce(new Error('SMTP down'));

      await expect(service.assignReport(makeReport())).resolves.not.toThrow();
    });

    it('does not throw when notification send fails during escalation', async () => {
      const admin = makeUser('admin-1', UserRole.ADMIN);
      mockUserRepo.createQueryBuilder.mockReturnValue(buildQb([admin]));
      mockNotificationsService.send.mockRejectedValueOnce(new Error('SMTP down'));

      await expect(service.escalateReport(makeReport())).resolves.not.toThrow();
    });
  });
});
