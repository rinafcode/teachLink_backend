import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AssessmentsService } from './assessments.service';
import { Assessment } from './entities/assessment.entity';
import { AssessmentAttempt } from './entities/assessment-attempt.entity';
import { Answer } from './entities/answer.entity';
import { Question } from './entities/question.entity';
import { AssessmentStatus } from './enums/assessment-status.enum';
import { ScoreCalculationService } from './scoring/score-calculation.service';
import { FeedbackGenerationService } from './feedback/feedback-generation.service';
import {
  createMockRepository,
  createMockQueryBuilder,
} from 'test/utils/mock-factories';
import { Repository } from 'typeorm';

describe('AssessmentsService', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // DECLARATIONS
  // ─────────────────────────────────────────────────────────────────────────

  let service: AssessmentsService;
  let mockAssessmentRepo: jest.Mocked<Repository<Assessment>>;
  let mockAttemptRepo: jest.Mocked<Repository<AssessmentAttempt>>;
  let mockAnswerRepo: jest.Mocked<Repository<Answer>>;
  let mockScoringService: jest.Mocked<ScoreCalculationService>;
  let mockFeedbackService: jest.Mocked<FeedbackGenerationService>;

  // ─────────────────────────────────────────────────────────────────────────
  // SETUP & TEARDOWN
  // ─────────────────────────────────────────────────────────────────────────

  beforeEach(async () => {
    // Initialize all dependency mocks
    mockAssessmentRepo = createMockRepository<Assessment>();
    mockAttemptRepo = createMockRepository<AssessmentAttempt>();
    mockAnswerRepo = createMockRepository<Answer>();

    mockScoringService = {
      calculate: jest.fn(),
    } as jest.Mocked<ScoreCalculationService>;

    mockFeedbackService = {
      generate: jest.fn(),
    } as jest.Mocked<FeedbackGenerationService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        {
          provide: getRepositoryToken(Assessment),
          useValue: mockAssessmentRepo,
        },
        {
          provide: getRepositoryToken(AssessmentAttempt),
          useValue: mockAttemptRepo,
        },
        {
          provide: getRepositoryToken(Answer),
          useValue: mockAnswerRepo,
        },
        {
          provide: ScoreCalculationService,
          useValue: mockScoringService,
        },
        {
          provide: FeedbackGenerationService,
          useValue: mockFeedbackService,
        },
      ],
    }).compile();

    service = module.get<AssessmentsService>(AssessmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST SUITES
  // ─────────────────────────────────────────────────────────────────────────

  describe('startAssessment', () => {
    const studentId = 'student-1';
    const assessmentId = 'assessment-1';
    const mockAssessment = {
      id: assessmentId,
      title: 'Test Assessment',
      questions: [
        { id: 'q1', question: 'Question 1' },
        { id: 'q2', question: 'Question 2' },
      ],
    };

    beforeEach(() => {
      mockAssessmentRepo.findOne.mockResolvedValue(mockAssessment);
      mockAttemptRepo.save.mockImplementation(async (attempt) => attempt);
    });

    it('should start an assessment and create an attempt', async () => {
      const result = await service.startAssessment(studentId, assessmentId);

      expect(result).toEqual({
        studentId,
        assessment: mockAssessment,
        status: AssessmentStatus.IN_PROGRESS,
        startedAt: expect.any(Date),
      });

      expect(mockAssessmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: assessmentId },
        relations: ['questions'],
      });
      expect(mockAttemptRepo.save).toHaveBeenCalled();
    });

    it('should load assessment with questions relation', async () => {
      await service.startAssessment(studentId, assessmentId);

      expect(mockAssessmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: assessmentId },
        relations: ['questions'],
      });
    });
  });

  describe('findAll', () => {
    const mockAssessments = [
      { id: '1', title: 'Assessment 1' },
      { id: '2', title: 'Assessment 2' },
    ];

    beforeEach(() => {
      mockAssessmentRepo.find.mockResolvedValue(mockAssessments);
    });

    it('should return all assessments with questions relation', async () => {
      const result = await service.findAll();

      expect(result).toEqual(mockAssessments);
      expect(mockAssessmentRepo.find).toHaveBeenCalledWith({
        relations: ['questions'],
      });
    });
  });

  describe('findOne', () => {
    const assessmentId = 'assessment-1';
    const mockAssessment = {
      id: assessmentId,
      title: 'Test Assessment',
      questions: [],
    };

    beforeEach(() => {
      mockAssessmentRepo.findOne.mockResolvedValue(mockAssessment);
    });

    it('should return assessment by id with questions relation', async () => {
      const result = await service.findOne(assessmentId);

      expect(result).toEqual(mockAssessment);
      expect(mockAssessmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: assessmentId },
        relations: ['questions'],
      });
    });
  });

  describe('findByIds', () => {
    const ids = ['1', '2', '3'];
    const mockAssessments = [
      { id: '1', title: 'Assessment 1' },
      { id: '2', title: 'Assessment 2' },
      { id: '3', title: 'Assessment 3' },
    ];

    beforeEach(() => {
      mockAssessmentRepo.findByIds.mockResolvedValue(mockAssessments);
    });

    it('should return assessments by ids', async () => {
      const result = await service.findByIds(ids);

      expect(result).toEqual(mockAssessments);
      expect(mockAssessmentRepo.findByIds).toHaveBeenCalledWith(ids);
    });

    it('should return empty array for empty ids', async () => {
      const result = await service.findByIds([]);

      expect(result).toEqual([]);
      expect(mockAssessmentRepo.findByIds).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const createData = {
      title: 'New Assessment',
      description: 'Test assessment',
      durationMinutes: 60,
    };

    const mockAssessment = {
      id: 'new-assessment-1',
      ...createData,
    };

    beforeEach(() => {
      mockAssessmentRepo.create.mockReturnValue(mockAssessment as Assessment);
      mockAssessmentRepo.save.mockResolvedValue(mockAssessment as Assessment);
    });

    it('should create and save a new assessment', async () => {
      const result = await service.create(createData);

      expect(result).toEqual(mockAssessment);
      expect(mockAssessmentRepo.create).toHaveBeenCalledWith(createData);
      expect(mockAssessmentRepo.save).toHaveBeenCalledWith(mockAssessment);
    });

    it('should handle array return from save', async () => {
      const savedArray = [mockAssessment];
      mockAssessmentRepo.save.mockResolvedValue(savedArray as any);

      const result = await service.create(createData);

      expect(result).toEqual(mockAssessment);
    });
  });

  describe('update', () => {
    const assessmentId = 'assessment-1';
    const updateData = { title: 'Updated Title' };
    const mockAssessment = {
      id: assessmentId,
      title: 'Updated Title',
      description: 'Original description',
    };

    beforeEach(() => {
      mockAssessmentRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });
      mockAssessmentRepo.findOne.mockResolvedValue(mockAssessment);
    });

    it('should update assessment and return updated entity', async () => {
      const result = await service.update(assessmentId, updateData);

      expect(result).toEqual(mockAssessment);
      expect(mockAssessmentRepo.update).toHaveBeenCalledWith(assessmentId, updateData);
      expect(mockAssessmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: assessmentId },
        relations: ['questions'],
      });
    });
  });

  describe('remove', () => {
    const assessmentId = 'assessment-1';
    const mockAssessment = {
      id: assessmentId,
      title: 'Test Assessment',
    };

    beforeEach(() => {
      mockAssessmentRepo.findOne.mockResolvedValue(mockAssessment);
      mockAssessmentRepo.manager = {
        transaction: jest.fn().mockImplementation(async (fn) => fn({
          getRepository: jest.fn().mockReturnValue({
            createQueryBuilder: jest.fn().mockReturnValue({
              softDelete: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              execute: jest.fn().mockResolvedValue(undefined),
            }),
          }),
        })),
      } as any;
    });

    it('should soft delete assessment and its questions', async () => {
      await service.remove(assessmentId);

      expect(mockAssessmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: assessmentId },
        relations: ['questions'],
      });
      expect(mockAssessmentRepo.manager.transaction).toHaveBeenCalled();
    });

    it('should do nothing if assessment not found', async () => {
      mockAssessmentRepo.findOne.mockResolvedValue(null);

      await service.remove(assessmentId);

      expect(mockAssessmentRepo.manager.transaction).not.toHaveBeenCalled();
    });
  });

  describe('submitAssessment', () => {
    const attemptId = 'attempt-1';
    const answers = [
      { questionId: 'q1', response: 'Answer 1' },
      { questionId: 'q2', response: 'Answer 2' },
    ];

    const mockAttempt = {
      id: attemptId,
      startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      assessment: {
        id: 'assessment-1',
        durationMinutes: 60,
        questions: [
          { id: 'q1', points: 10 },
          { id: 'q2', points: 15 },
        ],
      },
    };

    beforeEach(() => {
      mockAttemptRepo.findOne.mockResolvedValue(mockAttempt as any);
      mockScoringService.calculate
        .mockReturnValueOnce(8)  // Question 1: 8/10 points
        .mockReturnValueOnce(12); // Question 2: 12/15 points
      mockAnswerRepo.save.mockResolvedValue({} as any);
      mockAttemptRepo.save.mockImplementation(async (attempt) => attempt);
      mockFeedbackService.generate.mockReturnValue({
        overall: 'Good performance',
        strengths: ['Good understanding'],
        improvements: ['Need more practice'],
      });
    });

    it('should submit assessment and calculate score', async () => {
      const result = await service.submitAssessment(attemptId, answers);

      expect(result).toEqual({
        attempt: {
          ...mockAttempt,
          score: 20, // 8 + 12
          status: AssessmentStatus.GRADED,
          submittedAt: expect.any(Date),
        },
        feedback: {
          overall: 'Good performance',
          strengths: ['Good understanding'],
          improvements: ['Need more practice'],
        },
      });

      expect(mockAttemptRepo.findOne).toHaveBeenCalledWith({
        where: { id: attemptId },
        relations: ['assessment', 'assessment.questions'],
      });
      expect(mockScoringService.calculate).toHaveBeenCalledTimes(2);
      expect(mockAnswerRepo.save).toHaveBeenCalledTimes(2);
      expect(mockFeedbackService.generate).toHaveBeenCalledWith(20, 25); // totalScore, maxScore
    });

    it('should mark as timed out if submitted after duration', async () => {
      // Set startedAt to 2 hours ago, duration is 60 minutes
      const oldAttempt = {
        ...mockAttempt,
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      };
      mockAttemptRepo.findOne.mockResolvedValue(oldAttempt as any);

      const result = await service.submitAssessment(attemptId, answers);

      expect(result.status).toBe(AssessmentStatus.TIMED_OUT);
      expect(mockScoringService.calculate).not.toHaveBeenCalled();
    });
  });

  describe('getResults', () => {
    const attemptId = 'attempt-1';
    const mockResults = {
      id: attemptId,
      score: 85,
      answers: [
        {
          id: 'answer-1',
          question: { id: 'q1', question: 'Question 1' },
          response: 'Answer 1',
          awardedPoints: 8,
        },
      ],
    };

    beforeEach(() => {
      mockAttemptRepo.findOne.mockResolvedValue(mockResults as any);
    });

    it('should return assessment results with answers and questions', async () => {
      const result = await service.getResults(attemptId);

      expect(result).toEqual(mockResults);
      expect(mockAttemptRepo.findOne).toHaveBeenCalledWith({
        where: { id: attemptId },
        relations: ['answers', 'answers.question'],
      });
    });
  });
});