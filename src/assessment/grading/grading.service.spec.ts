import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GradingService } from './grading.service';
import { SubmissionGrade, SubmissionGradeStatus } from './entities/submission-grade.entity';
import { CriterionGrade } from './entities/criterion-grade.entity';
import { AssessmentAttempt } from '../entities/assessment-attempt.entity';
import { RubricsService } from './rubrics.service';
import { FeedbackTemplatesService } from './feedback-templates.service';
import { AssessmentStatus } from '../enums/assessment-status.enum';

// ── Fixtures ────────────────────────────────────────────────────────────────

const criterionId = 'c1';
const levelId = 'l1';

const mockLevel = { id: levelId, criterionId, points: 8, label: 'Good' };
const mockCriterion = {
  id: criterionId,
  title: 'Writing',
  maxPoints: 10,
  defaultLevelId: levelId,
  levels: [mockLevel],
};
const mockRubric = {
  id: 'r1',
  name: 'Essay',
  autoGradeEnabled: true,
  criteria: [mockCriterion],
};
const mockAttempt = {
  id: 'a1',
  score: 0,
  status: AssessmentStatus.SUBMITTED,
  submittedAt: null,
};
const mockGrade = {
  id: 'g1',
  attemptId: 'a1',
  status: SubmissionGradeStatus.GRADED,
  totalScore: 8,
  maxScore: 10,
  percentage: 80,
  criterionGrades: [],
  rubric: mockRubric,
};

// ── Mock helpers ─────────────────────────────────────────────────────────────

const makeGradeRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn().mockImplementation((v) => v),
  save: jest.fn().mockImplementation(async (v) => v),
});

const makeCriterionGradeRepo = () => ({
  create: jest.fn().mockImplementation((v) => v),
  save: jest.fn().mockImplementation(async (v) => v),
  delete: jest.fn().mockResolvedValue(undefined),
});

const makeAttemptRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn().mockImplementation(async (v) => v),
});

const makeDataSource = (
  gradeRepo: ReturnType<typeof makeGradeRepo>,
  cgRepo: ReturnType<typeof makeCriterionGradeRepo>,
  attemptRepo: ReturnType<typeof makeAttemptRepo>,
) => ({
  transaction: jest.fn().mockImplementation(async (cb: (manager: any) => Promise<any>) => {
    const manager = {
      getRepository: jest.fn().mockImplementation((entity: any) => {
        if (entity === SubmissionGrade) return gradeRepo;
        if (entity === CriterionGrade) return cgRepo;
        if (entity === AssessmentAttempt) return attemptRepo;
        return {};
      }),
    };
    return cb(manager);
  }),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GradingService', () => {
  let service: GradingService;
  let gradeRepo: ReturnType<typeof makeGradeRepo>;
  let criterionGradeRepo: ReturnType<typeof makeCriterionGradeRepo>;
  let attemptRepo: ReturnType<typeof makeAttemptRepo>;
  let rubricsService: { findOne: jest.Mock };
  let feedbackTemplatesService: {
    findOne: jest.Mock;
    findDefault: jest.Mock;
    render: jest.Mock;
  };

  beforeEach(async () => {
    gradeRepo = makeGradeRepo();
    criterionGradeRepo = makeCriterionGradeRepo();
    attemptRepo = makeAttemptRepo();

    rubricsService = { findOne: jest.fn().mockResolvedValue(mockRubric) };
    feedbackTemplatesService = {
      findOne: jest.fn(),
      findDefault: jest.fn().mockResolvedValue(null),
      render: jest.fn().mockReturnValue('Good job'),
    };

    // The outer-scope repos are used by findByAttempt; transaction uses inner repos.
    gradeRepo.findOne
      .mockResolvedValueOnce(null) // inside transaction: no existing grade
      .mockResolvedValueOnce({ ...mockGrade }); // final hydrated load

    attemptRepo.findOne.mockResolvedValue({ ...mockAttempt });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradingService,
        { provide: getRepositoryToken(SubmissionGrade), useValue: gradeRepo },
        { provide: getRepositoryToken(CriterionGrade), useValue: criterionGradeRepo },
        { provide: getRepositoryToken(AssessmentAttempt), useValue: attemptRepo },
        { provide: RubricsService, useValue: rubricsService },
        { provide: FeedbackTemplatesService, useValue: feedbackTemplatesService },
        {
          provide: DataSource,
          useValue: makeDataSource(gradeRepo, criterionGradeRepo, attemptRepo),
        },
      ],
    }).compile();

    service = module.get<GradingService>(GradingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── gradeSubmission ────────────────────────────────────────────────────────

  describe('gradeSubmission', () => {
    it('throws BadRequestException when score count mismatches rubric criteria', async () => {
      const dto = { rubricId: 'r1', attemptId: 'a1', scores: [] };
      await expect(service.gradeSubmission(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for unknown criterionId', async () => {
      const dto = {
        rubricId: 'r1',
        attemptId: 'a1',
        scores: [{ criterionId: 'unknown', points: 5 }],
      };
      await expect(service.gradeSubmission(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the same criterion is scored twice', async () => {
      const twoScoreSameRubric = {
        ...mockRubric,
        criteria: [
          { ...mockCriterion, id: 'c1' },
          { ...mockCriterion, id: 'c2' },
        ],
      };
      rubricsService.findOne.mockResolvedValue(twoScoreSameRubric);

      const dto = {
        rubricId: 'r1',
        attemptId: 'a1',
        scores: [
          { criterionId: 'c1', points: 5 },
          { criterionId: 'c1', points: 3 }, // duplicate
        ],
      };
      await expect(service.gradeSubmission(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when criterion score has neither levelId nor points', async () => {
      const dto = {
        rubricId: 'r1',
        attemptId: 'a1',
        scores: [{ criterionId }],
      };
      await expect(service.gradeSubmission(dto)).rejects.toThrow(BadRequestException);
    });

    it('caps points at criterion maxPoints', async () => {
      const dto = {
        rubricId: 'r1',
        attemptId: 'a1',
        scores: [{ criterionId, points: 999 }],
      };
      await service.gradeSubmission(dto);
      // grade should be saved with totalScore = 10 (capped)
      const savedGrade = gradeRepo.save.mock.calls[0][0];
      expect(savedGrade.totalScore).toBe(10);
    });

    it('resolves points from levelId when provided', async () => {
      const dto = {
        rubricId: 'r1',
        attemptId: 'a1',
        scores: [{ criterionId, levelId }],
      };
      await service.gradeSubmission(dto);
      const savedGrade = gradeRepo.save.mock.calls[0][0];
      expect(savedGrade.totalScore).toBe(8);
    });

    it('throws NotFoundException for missing attempt', async () => {
      attemptRepo.findOne.mockResolvedValue(null);
      const dto = {
        rubricId: 'r1',
        attemptId: 'missing',
        scores: [{ criterionId, points: 5 }],
      };
      await expect(service.gradeSubmission(dto)).rejects.toThrow(NotFoundException);
    });
  });

  // ── autoGradeSubmission ────────────────────────────────────────────────────

  describe('autoGradeSubmission', () => {
    it('throws BadRequestException when rubric is not auto-grade enabled', async () => {
      rubricsService.findOne.mockResolvedValue({ ...mockRubric, autoGradeEnabled: false });
      await expect(
        service.autoGradeSubmission({ rubricId: 'r1', attemptId: 'a1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when a criterion has no defaultLevelId', async () => {
      rubricsService.findOne.mockResolvedValue({
        ...mockRubric,
        criteria: [{ ...mockCriterion, defaultLevelId: null }],
      });
      await expect(
        service.autoGradeSubmission({ rubricId: 'r1', attemptId: 'a1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('auto-grades using default level points', async () => {
      await service.autoGradeSubmission({ rubricId: 'r1', attemptId: 'a1' });
      const savedGrade = gradeRepo.save.mock.calls[0][0];
      expect(savedGrade.totalScore).toBe(8);
      expect(savedGrade.status).toBe(SubmissionGradeStatus.AUTO_GRADED);
    });
  });

  // ── findByAttempt ──────────────────────────────────────────────────────────

  describe('findByAttempt', () => {
    it('returns the grade for an attempt', async () => {
      gradeRepo.findOne.mockReset();
      gradeRepo.findOne.mockResolvedValue(mockGrade);
      const result = await service.findByAttempt('a1');
      expect(result).toBe(mockGrade);
    });

    it('throws NotFoundException when no grade exists for the attempt', async () => {
      gradeRepo.findOne.mockReset();
      gradeRepo.findOne.mockResolvedValue(null);
      await expect(service.findByAttempt('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
