import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '../../users/entities/user.entity';
import { ContentReport } from '../reports/content-report.entity';
import { ContentReportStatus } from '../reports/content-report-status.enum';
import { ContentReportReason } from '../reports/content-report-reason.enum';
import { NotificationsService } from '../../notifications/notifications.service';
import { AdminSelectionStrategy, ReportAssignmentService } from './report-assignment.service';

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
  createQueryBuilder: jest.fn(),
  save: jest.fn((r: ContentReport) => Promise.resolve(r)),
  find: jest.fn().mockResolvedValue([]),
};

const mockNotificationsService: jest.Mocked<Pick<NotificationsService, 'send'>> = {
  send: jest.fn().mockResolvedValue({}),
};

const mockConfigService = {
  get: jest.fn((key: string, fallback?: unknown) => fallback),
};

// ─── QueryBuilder helpers ──────────────────────────────────────────────────────

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

function buildReportQb(loadRows: Record<string, number>[]) {
  const qb: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(loadRows),
  };
  qb.select = jest.fn().mockReturnValue(qb);
  qb.addSelect = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.groupBy = jest.fn().mockReturnValue(qb);
  return qb;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReportAssignmentService', () => {
  let service: ReportAssignmentService;

  beforeEach(async () => {
    mockUserRepo.createQueryBuilder.mockClear();
    mockReportRepo.createQueryBuilder.mockClear();
    mockReportRepo.save.mockClear();
    mockReportRepo.find.mockClear();
    mockNotificationsService.send.mockClear();
    mockConfigService.get.mockClear();

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

  describe('escalateReport with least_loaded strategy', () => {
    it('reassigns report to the least-loaded admin and sets escalatedAt', async () => {
      const admin2 = makeUser('admin-2', UserRole.ADMIN);
      const admin1 = makeUser('admin-1', UserRole.ADMIN);
      const admin3 = makeUser('admin-3', UserRole.ADMIN);
      mockUserRepo.createQueryBuilder.mockReturnValue(buildQb([admin1, admin2, admin3]));
      mockReportRepo.createQueryBuilder.mockReturnValue(
        buildReportQb([{ moderatorId: 'admin-1', count: '5' }, { moderatorId: 'admin-2', count: '1' }, { moderatorId: 'admin-3', count: '3' }]),
      );

      const report = makeReport();
      const result = await service.escalateReport(report);

      expect(result.assignedModeratorId).toBe('admin-2');
      expect(result.escalatedAt).toBeInstanceOf(Date);
    });

    it('sends an URGENT escalation notification to the selected admin', async () => {
      const admin2 = makeUser('admin-2', UserRole.ADMIN);
      const admin1 = makeUser('admin-1', UserRole.ADMIN);
      mockUserRepo.createQueryBuilder.mockReturnValue(buildQb([admin1, admin2]));
      mockReportRepo.createQueryBuilder.mockReturnValue(
        buildReportQb([{ moderatorId: 'admin-1', count: '5' }, { moderatorId: 'admin-2', count: '1' }]),
      );

      await service.escalateReport(makeReport());

      expect(mockNotificationsService.send).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-2', priority: 'urgent' }),
      );
    });

    it('does not throw when no admins exist', async () => {
      mockUserRepo.createQueryBuilder.mockReturnValue(buildQb([]));

      const report = makeReport();
      const result = await service.escalateReport(report);

      expect(result.escalatedAt).toBeUndefined();
      expect(mockReportRepo.save).not.toHaveBeenCalled();
      expect(mockReportRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  // ─── selectEscalationTarget ───────────────────────────────────────────────

  describe('selectEscalationTarget', () => {
    it('selects the admin with the lowest open report count', () => {
      const admins = [makeUser('admin-1'), makeUser('admin-2'), makeUser('admin-3')];
      const loadMap = { 'admin-1': 5, 'admin-2': 1, 'admin-3': 3 };

      expect(ReportAssignmentService.selectEscalationTarget(admins, loadMap).id).toBe('admin-2');
    });

    it('breaks loads ties by lowest admin id', () => {
      const admins = [makeUser('admin-1'), makeUser('admin-2'), makeUser('admin-3')];
      const loadMap = { 'admin-1': 1, 'admin-2': 1, 'admin-3': 2 };

      expect(ReportAssignmentService.selectEscalationTarget(admins, loadMap).id).toBe('admin-1');
    });

    it('treats missing admins in loadMap as zero load', () => {
      const admins = [makeUser('admin-1'), makeUser('admin-2'), makeUser('admin-3')];
      const loadMap = { 'admin-2': 2 };

      expect(ReportAssignmentService.selectEscalationTarget(admins, loadMap).id).toBe('admin-1');
    });
  });

  // ─── escalateOverdueReports ──────────────────────────────────────────────

  describe('escalateOverdueReports', () => {
    it('escalates overdue reports found by the repository', async () => {
      const overdueReport = makeReport('r-overdue');
      mockReportRepo.find.mockResolvedValueOnce([overdueReport]);

      const admin = makeUser('admin-1', UserRole.ADMIN);
      mockUserRepo.createQueryBuilder.mockReturnValue(buildQb([admin]));
      mockReportRepo.createQueryBuilder.mockReturnValue(
        buildReportQb([{ moderatorId: 'admin-1', count: '3' }]),
      );

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
      mockReportRepo.createQueryBuilder.mockReturnValue(
        buildReportQb([{ moderatorId: 'admin-1', count: '3' }]),
      );
      mockNotificationsService.send.mockRejectedValueOnce(new Error('SMTP down'));

      await expect(service.escalateReport(makeReport())).resolves.not.toThrow();
    });
  });
});
