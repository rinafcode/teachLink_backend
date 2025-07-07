import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationService } from './moderation.service';
import { AutoModerationService } from './auto/auto-moderation.service';
import { ManualReviewService } from './manual/manual-review.service';
import { ContentSafetyService } from './safety/content-safety.service';
import { ModerationAnalyticsService } from './analytics/moderation-analytics.service';
import { ContentReport, ReportStatus, ReportType } from './entities/content-report.entity';
import { ModerationQueue, QueueStatus, QueuePriority } from './entities/moderation-queue.entity';
import { ModerationAction, ActionType, ActionSeverity } from './entities/moderation-action.entity';
import { SafetyScore } from './entities/safety-score.entity';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { CreateModerationActionDto } from './dto/moderation-action.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ModerationService', () => {
  let service: ModerationService;
  let contentReportRepository: Repository<ContentReport>;
  let moderationQueueRepository: Repository<ModerationQueue>;
  let moderationActionRepository: Repository<ModerationAction>;
  let safetyScoreRepository: Repository<SafetyScore>;
  let autoModerationService: AutoModerationService;
  let manualReviewService: ManualReviewService;
  let contentSafetyService: ContentSafetyService;
  let moderationAnalyticsService: ModerationAnalyticsService;

  const mockContentReportRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    })),
  };

  const mockModerationQueueRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    })),
  };

  const mockModerationActionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockSafetyScoreRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAutoModerationService = {
    processContent: jest.fn(),
  };

  const mockManualReviewService = {
    getAvailableContent: jest.fn(),
    assignContentToModerator: jest.fn(),
    startReview: jest.fn(),
    submitReview: jest.fn(),
    escalateContent: jest.fn(),
    getReviewHistory: jest.fn(),
    getContentContext: jest.fn(),
  };

  const mockContentSafetyService = {
    analyzeContent: jest.fn(),
  };

  const mockModerationAnalyticsService = {
    recordReview: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: getRepositoryToken(ContentReport),
          useValue: mockContentReportRepository,
        },
        {
          provide: getRepositoryToken(ModerationQueue),
          useValue: mockModerationQueueRepository,
        },
        {
          provide: getRepositoryToken(ModerationAction),
          useValue: mockModerationActionRepository,
        },
        {
          provide: getRepositoryToken(SafetyScore),
          useValue: mockSafetyScoreRepository,
        },
        {
          provide: AutoModerationService,
          useValue: mockAutoModerationService,
        },
        {
          provide: ManualReviewService,
          useValue: mockManualReviewService,
        },
        {
          provide: ContentSafetyService,
          useValue: mockContentSafetyService,
        },
        {
          provide: ModerationAnalyticsService,
          useValue: mockModerationAnalyticsService,
        },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
    contentReportRepository = module.get<Repository<ContentReport>>(getRepositoryToken(ContentReport));
    moderationQueueRepository = module.get<Repository<ModerationQueue>>(getRepositoryToken(ModerationQueue));
    moderationActionRepository = module.get<Repository<ModerationAction>>(getRepositoryToken(ModerationAction));
    safetyScoreRepository = module.get<Repository<SafetyScore>>(getRepositoryToken(SafetyScore));
    autoModerationService = module.get<AutoModerationService>(AutoModerationService);
    manualReviewService = module.get<ManualReviewService>(ManualReviewService);
    contentSafetyService = module.get<ContentSafetyService>(ContentSafetyService);
    moderationAnalyticsService = module.get<ModerationAnalyticsService>(ModerationAnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reportContent', () => {
    it('should create a content report and add to moderation queue', async () => {
      const reporterId = 'user-123';
      const reportDto: CreateContentReportDto = {
        contentId: 'content-123',
        contentType: 'course',
        reportType: ReportType.INAPPROPRIATE,
        description: 'Inappropriate content',
      };

      const mockReport = {
        id: 'report-123',
        ...reportDto,
        reporterId,
        status: ReportStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSafetyScore = {
        id: 'safety-123',
        contentId: 'content-123',
        contentType: 'course',
        overallScore: 0.3,
        categoryScores: {},
        flaggedCategories: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockQueueItem = {
        id: 'queue-123',
        contentId: 'content-123',
        contentType: 'course',
        priority: QueuePriority.HIGH,
        status: QueueStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockContentReportRepository.create.mockReturnValue(mockReport);
      mockContentReportRepository.save.mockResolvedValue(mockReport);
      mockContentSafetyService.analyzeContent.mockResolvedValue(mockSafetyScore);
      mockModerationQueueRepository.create.mockReturnValue(mockQueueItem);
      mockModerationQueueRepository.save.mockResolvedValue(mockQueueItem);
      mockAutoModerationService.processContent.mockResolvedValue({});

      const result = await service.reportContent(reporterId, reportDto);

      expect(mockContentReportRepository.create).toHaveBeenCalledWith({
        reporterId,
        ...reportDto,
        status: ReportStatus.PENDING,
      });
      expect(mockContentReportRepository.save).toHaveBeenCalledWith(mockReport);
      expect(mockContentSafetyService.analyzeContent).toHaveBeenCalledWith(
        reportDto.contentId,
        reportDto.contentType,
      );
      expect(mockAutoModerationService.processContent).toHaveBeenCalledWith(
        reportDto.contentId,
        reportDto.contentType,
      );
      expect(result).toEqual(mockReport);
    });
  });

  describe('getModerationQueue', () => {
    it('should return moderation queue with filters', async () => {
      const mockQueueItems = [
        {
          id: 'queue-1',
          contentId: 'content-1',
          contentType: 'course',
          priority: QueuePriority.HIGH,
          status: QueueStatus.PENDING,
        },
        {
          id: 'queue-2',
          contentId: 'content-2',
          contentType: 'lesson',
          priority: QueuePriority.MEDIUM,
          status: QueueStatus.PENDING,
        },
      ];

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockQueueItems, 2]),
      };

      mockModerationQueueRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getModerationQueue(
        'moderator-123',
        QueueStatus.PENDING,
        QueuePriority.HIGH,
        20,
        0,
      );

      expect(mockModerationQueueRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('queue.assignedModeratorId = :moderatorId', {
        moderatorId: 'moderator-123',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('queue.status = :status', {
        status: QueueStatus.PENDING,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('queue.priority = :priority', {
        priority: QueuePriority.HIGH,
      });
      expect(result).toEqual({ items: mockQueueItems, total: 2 });
    });
  });

  describe('assignContentToModerator', () => {
    it('should assign content to moderator successfully', async () => {
      const queueId = 'queue-123';
      const moderatorId = 'moderator-123';

      const mockQueueItem = {
        id: queueId,
        contentId: 'content-123',
        contentType: 'course',
        status: QueueStatus.PENDING,
        assignedModeratorId: null,
        assignedAt: null,
      };

      const updatedQueueItem = {
        ...mockQueueItem,
        assignedModeratorId: moderatorId,
        status: QueueStatus.ASSIGNED,
        assignedAt: new Date(),
      };

      mockModerationQueueRepository.findOne.mockResolvedValue(mockQueueItem);
      mockModerationQueueRepository.save.mockResolvedValue(updatedQueueItem);

      const result = await service.assignContentToModerator(queueId, moderatorId);

      expect(mockModerationQueueRepository.findOne).toHaveBeenCalledWith({ where: { id: queueId } });
      expect(mockModerationQueueRepository.save).toHaveBeenCalledWith(updatedQueueItem);
      expect(result).toEqual(updatedQueueItem);
    });

    it('should throw NotFoundException when queue item not found', async () => {
      const queueId = 'queue-123';
      const moderatorId = 'moderator-123';

      mockModerationQueueRepository.findOne.mockResolvedValue(null);

      await expect(service.assignContentToModerator(queueId, moderatorId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when content is not available for assignment', async () => {
      const queueId = 'queue-123';
      const moderatorId = 'moderator-123';

      const mockQueueItem = {
        id: queueId,
        status: QueueStatus.ASSIGNED, // Not PENDING
      };

      mockModerationQueueRepository.findOne.mockResolvedValue(mockQueueItem);

      await expect(service.assignContentToModerator(queueId, moderatorId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reviewContent', () => {
    it('should review content and create moderation action', async () => {
      const queueId = 'queue-123';
      const moderatorId = 'moderator-123';
      const actionDto: CreateModerationActionDto = {
        contentId: 'content-123',
        contentType: 'course',
        actionType: ActionType.REMOVE_CONTENT,
        severity: ActionSeverity.HIGH,
        reason: 'Violation of community guidelines',
      };

      const mockQueueItem = {
        id: queueId,
        contentId: 'content-123',
        contentType: 'course',
        assignedModeratorId: moderatorId,
        status: QueueStatus.ASSIGNED,
      };

      const mockAction = {
        id: 'action-123',
        ...actionDto,
        moderatorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedQueueItem = {
        ...mockQueueItem,
        status: QueueStatus.COMPLETED,
        reviewedAt: new Date(),
      };

      mockModerationQueueRepository.findOne.mockResolvedValue(mockQueueItem);
      mockModerationActionRepository.create.mockReturnValue(mockAction);
      mockModerationActionRepository.save.mockResolvedValue(mockAction);
      mockModerationQueueRepository.save.mockResolvedValue(updatedQueueItem);
      mockModerationAnalyticsService.recordReview.mockResolvedValue(undefined);

      const result = await service.reviewContent(queueId, moderatorId, actionDto);

      expect(mockModerationActionRepository.create).toHaveBeenCalledWith({
        ...actionDto,
        moderatorId,
      });
      expect(mockModerationActionRepository.save).toHaveBeenCalledWith(mockAction);
      expect(mockModerationQueueRepository.save).toHaveBeenCalledWith(updatedQueueItem);
      expect(mockModerationAnalyticsService.recordReview).toHaveBeenCalledWith(
        moderatorId,
        actionDto.actionType,
      );
      expect(result).toEqual({ queue: updatedQueueItem, action: mockAction });
    });

    it('should throw BadRequestException when content not assigned to moderator', async () => {
      const queueId = 'queue-123';
      const moderatorId = 'moderator-123';
      const actionDto: CreateModerationActionDto = {
        contentId: 'content-123',
        contentType: 'course',
        actionType: ActionType.REMOVE_CONTENT,
        severity: ActionSeverity.HIGH,
        reason: 'Violation of community guidelines',
      };

      const mockQueueItem = {
        id: queueId,
        assignedModeratorId: 'different-moderator',
      };

      mockModerationQueueRepository.findOne.mockResolvedValue(mockQueueItem);

      await expect(service.reviewContent(queueId, moderatorId, actionDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getContentReports', () => {
    it('should return content reports with filters', async () => {
      const mockReports = [
        {
          id: 'report-1',
          contentId: 'content-123',
          contentType: 'course',
          reportType: ReportType.INAPPROPRIATE,
          status: ReportStatus.PENDING,
        },
      ];

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockReports, 1]),
      };

      mockContentReportRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getContentReports('content-123', ReportStatus.PENDING, 20, 0);

      expect(mockContentReportRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('report.contentId = :contentId', {
        contentId: 'content-123',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('report.status = :status', {
        status: ReportStatus.PENDING,
      });
      expect(result).toEqual({ items: mockReports, total: 1 });
    });
  });

  describe('getSafetyScore', () => {
    it('should return safety score for content', async () => {
      const contentId = 'content-123';
      const mockSafetyScore = {
        id: 'safety-123',
        contentId,
        overallScore: 0.8,
        categoryScores: {},
        flaggedCategories: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSafetyScoreRepository.findOne.mockResolvedValue(mockSafetyScore);

      const result = await service.getSafetyScore(contentId);

      expect(mockSafetyScoreRepository.findOne).toHaveBeenCalledWith({
        where: { contentId },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockSafetyScore);
    });

    it('should throw NotFoundException when safety score not found', async () => {
      const contentId = 'content-123';

      mockSafetyScoreRepository.findOne.mockResolvedValue(null);

      await expect(service.getSafetyScore(contentId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('reanalyzeContent', () => {
    it('should reanalyze content and update queue priority', async () => {
      const contentId = 'content-123';
      const contentType = 'course';

      const mockSafetyScore = {
        id: 'safety-123',
        contentId,
        contentType,
        overallScore: 0.6,
        categoryScores: {},
        flaggedCategories: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockContentSafetyService.analyzeContent.mockResolvedValue(mockSafetyScore);
      mockModerationQueueRepository.findOne.mockResolvedValue({
        id: 'queue-123',
        contentId,
        priority: QueuePriority.MEDIUM,
      });
      mockModerationQueueRepository.save.mockResolvedValue({});

      const result = await service.reanalyzeContent(contentId, contentType);

      expect(mockContentSafetyService.analyzeContent).toHaveBeenCalledWith(contentId, contentType);
      expect(result).toEqual(mockSafetyScore);
    });
  });
}); 