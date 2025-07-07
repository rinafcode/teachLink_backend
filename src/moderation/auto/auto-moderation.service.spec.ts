import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutoModerationService } from './auto-moderation.service';
import { ContentSafetyService } from '../safety/content-safety.service';
import { ModerationAction, ActionType, ActionSeverity } from '../entities/moderation-action.entity';
import { SafetyScore, SafetyCategory } from '../entities/safety-score.entity';

describe('AutoModerationService', () => {
  let service: AutoModerationService;
  let moderationActionRepository: Repository<ModerationAction>;
  let safetyScoreRepository: Repository<SafetyScore>;
  let contentSafetyService: ContentSafetyService;

  const mockModerationActionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    })),
  };

  const mockSafetyScoreRepository = {
    findOne: jest.fn(),
  };

  const mockContentSafetyService = {
    analyzeContent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoModerationService,
        {
          provide: getRepositoryToken(ModerationAction),
          useValue: mockModerationActionRepository,
        },
        {
          provide: getRepositoryToken(SafetyScore),
          useValue: mockSafetyScoreRepository,
        },
        {
          provide: ContentSafetyService,
          useValue: mockContentSafetyService,
        },
      ],
    }).compile();

    service = module.get<AutoModerationService>(AutoModerationService);
    moderationActionRepository = module.get<Repository<ModerationAction>>(getRepositoryToken(ModerationAction));
    safetyScoreRepository = module.get<Repository<SafetyScore>>(getRepositoryToken(SafetyScore));
    contentSafetyService = module.get<ContentSafetyService>(ContentSafetyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processContent', () => {
    it('should process content and return moderation result', async () => {
      const contentId = 'content-123';
      const contentType = 'course';

      const mockSafetyScore = {
        id: 'safety-123',
        contentId,
        contentType,
        overallScore: 0.2,
        categoryScores: {
          [SafetyCategory.VIOLENCE]: 0.1,
          [SafetyCategory.HARASSMENT]: 0.8,
          [SafetyCategory.HATE_SPEECH]: 0.9,
          [SafetyCategory.SEXUAL_CONTENT]: 0.9,
          [SafetyCategory.SPAM]: 0.8,
          [SafetyCategory.MISINFORMATION]: 0.7,
          [SafetyCategory.COPYRIGHT]: 0.8,
          [SafetyCategory.PRIVACY]: 0.9,
        },
        flaggedCategories: [SafetyCategory.VIOLENCE],
        aiAnalysis: { confidence: 0.8 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAction = {
        id: 'action-123',
        contentId,
        contentType,
        actionType: ActionType.REMOVE_CONTENT,
        severity: ActionSeverity.CRITICAL,
        reason: 'Automated action: Content flagged for violations: violence. Overall safety score: 0.20',
        evidence: {
          autoModeration: true,
          confidence: 0.8,
          categories: [SafetyCategory.VIOLENCE],
          riskLevel: 'critical',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSafetyScoreRepository.findOne.mockResolvedValue(mockSafetyScore);
      mockModerationActionRepository.create.mockReturnValue(mockAction);
      mockModerationActionRepository.save.mockResolvedValue(mockAction);

      const result = await service.processContent(contentId, contentType);

      expect(mockSafetyScoreRepository.findOne).toHaveBeenCalledWith({
        where: { contentId },
        order: { createdAt: 'DESC' },
      });
      expect(mockModerationActionRepository.create).toHaveBeenCalled();
      expect(mockModerationActionRepository.save).toHaveBeenCalledWith(mockAction);
      expect(result.flagged).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.recommendedAction).toBe(ActionType.REMOVE_CONTENT);
    });

    it('should create safety score if not exists', async () => {
      const contentId = 'content-123';
      const contentType = 'course';

      const mockSafetyScore = {
        id: 'safety-123',
        contentId,
        contentType,
        overallScore: 0.8,
        categoryScores: {
          [SafetyCategory.VIOLENCE]: 0.9,
          [SafetyCategory.HARASSMENT]: 0.9,
          [SafetyCategory.HATE_SPEECH]: 0.9,
          [SafetyCategory.SEXUAL_CONTENT]: 0.9,
          [SafetyCategory.SPAM]: 0.8,
          [SafetyCategory.MISINFORMATION]: 0.7,
          [SafetyCategory.COPYRIGHT]: 0.8,
          [SafetyCategory.PRIVACY]: 0.9,
        },
        flaggedCategories: [],
        aiAnalysis: { confidence: 0.9 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSafetyScoreRepository.findOne.mockResolvedValue(null);
      mockContentSafetyService.analyzeContent.mockResolvedValue(mockSafetyScore);

      const result = await service.processContent(contentId, contentType);

      expect(mockContentSafetyService.analyzeContent).toHaveBeenCalledWith(contentId, contentType);
      expect(result.flagged).toBe(false);
      expect(result.riskLevel).toBe('low');
    });

    it('should handle errors gracefully', async () => {
      const contentId = 'content-123';
      const contentType = 'course';

      mockSafetyScoreRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.processContent(contentId, contentType)).rejects.toThrow('Database error');
    });
  });

  describe('analyzeContent', () => {
    it('should analyze content and return moderation result', async () => {
      const mockSafetyScore = {
        id: 'safety-123',
        contentId: 'content-123',
        contentType: 'course',
        overallScore: 0.1,
        categoryScores: {
          [SafetyCategory.VIOLENCE]: 0.1,
          [SafetyCategory.HARASSMENT]: 0.2,
          [SafetyCategory.HATE_SPEECH]: 0.9,
          [SafetyCategory.SEXUAL_CONTENT]: 0.9,
          [SafetyCategory.SPAM]: 0.8,
          [SafetyCategory.MISINFORMATION]: 0.7,
          [SafetyCategory.COPYRIGHT]: 0.8,
          [SafetyCategory.PRIVACY]: 0.9,
        },
        flaggedCategories: [SafetyCategory.VIOLENCE, SafetyCategory.HARASSMENT],
        aiAnalysis: { confidence: 0.7 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.analyzeContent(mockSafetyScore);

      expect(result.flagged).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.recommendedAction).toBe(ActionType.REMOVE_CONTENT);
      expect(result.categories).toEqual([SafetyCategory.VIOLENCE, SafetyCategory.HARASSMENT]);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.explanation).toContain('violence');
      expect(result.explanation).toContain('harassment');
    });

    it('should handle safe content correctly', async () => {
      const mockSafetyScore = {
        id: 'safety-123',
        contentId: 'content-123',
        contentType: 'course',
        overallScore: 0.9,
        categoryScores: {
          [SafetyCategory.VIOLENCE]: 0.9,
          [SafetyCategory.HARASSMENT]: 0.9,
          [SafetyCategory.HATE_SPEECH]: 0.9,
          [SafetyCategory.SEXUAL_CONTENT]: 0.9,
          [SafetyCategory.SPAM]: 0.8,
          [SafetyCategory.MISINFORMATION]: 0.7,
          [SafetyCategory.COPYRIGHT]: 0.8,
          [SafetyCategory.PRIVACY]: 0.9,
        },
        flaggedCategories: [],
        aiAnalysis: { confidence: 0.9 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.analyzeContent(mockSafetyScore);

      expect(result.flagged).toBe(false);
      expect(result.riskLevel).toBe('low');
      expect(result.recommendedAction).toBeUndefined();
      expect(result.categories).toEqual([]);
      expect(result.explanation).toContain('appears safe');
    });

    it('should detect violations correctly', async () => {
      const mockSafetyScore = {
        id: 'safety-123',
        contentId: 'content-123',
        contentType: 'course',
        overallScore: 0.4,
        categoryScores: {
          [SafetyCategory.VIOLENCE]: 0.2,
          [SafetyCategory.HARASSMENT]: 0.9,
          [SafetyCategory.HATE_SPEECH]: 0.2,
          [SafetyCategory.SEXUAL_CONTENT]: 0.9,
          [SafetyCategory.SPAM]: 0.1,
          [SafetyCategory.MISINFORMATION]: 0.3,
          [SafetyCategory.COPYRIGHT]: 0.8,
          [SafetyCategory.PRIVACY]: 0.9,
        },
        flaggedCategories: [SafetyCategory.VIOLENCE, SafetyCategory.HATE_SPEECH, SafetyCategory.SPAM],
        aiAnalysis: { confidence: 0.8 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.analyzeContent(mockSafetyScore);

      expect(result.flagged).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.recommendedAction).toBe(ActionType.HIDE_CONTENT);
      expect(result.categories).toContain(SafetyCategory.VIOLENCE);
      expect(result.categories).toContain(SafetyCategory.HATE_SPEECH);
      expect(result.categories).toContain(SafetyCategory.SPAM);
    });
  });

  describe('getModerationStats', () => {
    it('should return moderation statistics', async () => {
      const mockActions = [
        {
          evidence: { autoModeration: true, confidence: 0.8 },
          actionType: ActionType.REMOVE_CONTENT,
        },
        {
          evidence: { autoModeration: true, confidence: 0.9 },
          actionType: ActionType.HIDE_CONTENT,
        },
        {
          evidence: { autoModeration: true, confidence: 0.7 },
          actionType: ActionType.FLAG_FOR_REVIEW,
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockActions, 3]),
      };

      mockModerationActionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getModerationStats();

      expect(mockModerationActionRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'action.evidence->>\'autoModeration\' = :autoMod',
        { autoMod: 'true' },
      );
      expect(result.totalProcessed).toBe(3);
      expect(result.flaggedContent).toBe(3);
      expect(result.automatedActions).toBe(3);
      expect(result.averageConfidence).toBeCloseTo(0.8, 1);
    });

    it('should handle empty results', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockModerationActionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getModerationStats();

      expect(result.totalProcessed).toBe(0);
      expect(result.flaggedContent).toBe(0);
      expect(result.automatedActions).toBe(0);
      expect(result.averageConfidence).toBe(0);
    });
  });

  describe('threshold calculations', () => {
    it('should calculate priority correctly based on safety score', async () => {
      const testCases = [
        { score: 0.05, expectedPriority: 'critical' },
        { score: 0.2, expectedPriority: 'high' },
        { score: 0.4, expectedPriority: 'medium' },
        { score: 0.8, expectedPriority: 'low' },
      ];

      for (const testCase of testCases) {
        const mockSafetyScore = {
          id: 'safety-123',
          contentId: 'content-123',
          contentType: 'course',
          overallScore: testCase.score,
          categoryScores: {
            [SafetyCategory.VIOLENCE]: 0.9,
            [SafetyCategory.HARASSMENT]: 0.9,
            [SafetyCategory.HATE_SPEECH]: 0.9,
            [SafetyCategory.SEXUAL_CONTENT]: 0.9,
            [SafetyCategory.SPAM]: 0.8,
            [SafetyCategory.MISINFORMATION]: 0.7,
            [SafetyCategory.COPYRIGHT]: 0.8,
            [SafetyCategory.PRIVACY]: 0.9,
          },
          flaggedCategories: [],
          aiAnalysis: { confidence: 0.8 },
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await service.analyzeContent(mockSafetyScore);
        expect(result.riskLevel).toBe(testCase.expectedPriority);
      }
    });
  });

  describe('confidence calculation', () => {
    it('should calculate confidence based on AI analysis and consistency', async () => {
      const mockSafetyScore = {
        id: 'safety-123',
        contentId: 'content-123',
        contentType: 'course',
        overallScore: 0.5,
        categoryScores: {
          [SafetyCategory.VIOLENCE]: 0.5,
          [SafetyCategory.HARASSMENT]: 0.5,
          [SafetyCategory.HATE_SPEECH]: 0.5,
          [SafetyCategory.SEXUAL_CONTENT]: 0.5,
          [SafetyCategory.SPAM]: 0.5,
          [SafetyCategory.MISINFORMATION]: 0.5,
          [SafetyCategory.COPYRIGHT]: 0.5,
          [SafetyCategory.PRIVACY]: 0.5,
        },
        flaggedCategories: [],
        aiAnalysis: { confidence: 0.8 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.analyzeContent(mockSafetyScore);

      // High consistency should increase confidence
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should handle missing AI analysis', async () => {
      const mockSafetyScore = {
        id: 'safety-123',
        contentId: 'content-123',
        contentType: 'course',
        overallScore: 0.5,
        categoryScores: {
          [SafetyCategory.VIOLENCE]: 0.5,
          [SafetyCategory.HARASSMENT]: 0.5,
          [SafetyCategory.HATE_SPEECH]: 0.5,
          [SafetyCategory.SEXUAL_CONTENT]: 0.5,
          [SafetyCategory.SPAM]: 0.5,
          [SafetyCategory.MISINFORMATION]: 0.5,
          [SafetyCategory.COPYRIGHT]: 0.5,
          [SafetyCategory.PRIVACY]: 0.5,
        },
        flaggedCategories: [],
        aiAnalysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.analyzeContent(mockSafetyScore);

      expect(result.confidence).toBe(0.5);
    });
  });
}); 