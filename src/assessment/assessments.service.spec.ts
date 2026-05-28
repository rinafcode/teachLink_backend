import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { Assessment } from './entities/assessment.entity';
import { AssessmentAttempt } from './entities/assessment-attempt.entity';
import { Answer } from './entities/answer.entity';
import { FeedbackGenerationService } from './feedback/feedback-generation.service';
import { ScoreCalculationService } from './scoring/score-calculation.service';
import { AssessmentStatus } from './enums/assessment-status.enum';
import { QuestionType } from './enums/question-type.enum';

const mockAssessmentRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  findByIds: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  manager: {
    transaction: jest.fn(),
  },
};

const mockAttemptRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockAnswerRepo = {
  save: jest.fn(),
};

const mockScoringService = {
  calculate: jest.fn(),
};

const mockFeedbackService = {
  generate: jest.fn(),
};

const baseAssessment = {
  id: 'assess-1',
  title: 'JS Basics',
  durationMinutes: 30,
  questions: [
    {
      id: 'q-1',
      type: QuestionType.MULTIPLE_CHOICE,
      correctAnswer: 'A',
      points: 10,
    },
  ],
};

describe('AssessmentsService', () => {
  let service: AssessmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        { provide: getRepositoryToken(Assessment), useValue: mockAssessmentRepo },
        { provide: getRepositoryToken(AssessmentAttempt), useValue: mockAttemptRepo },
        { provide: getRepositoryToken(Answer), useValue: mockAnswerRepo },
        { provide: ScoreCalculationService, useValue: mockScoringService },
        { provide: FeedbackGenerationService, useValue: mockFeedbackService },
      ],
    }).compile();

    service = module.get<AssessmentsService>(AssessmentsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all assessments with questions', async () => {
      mockAssessmentRepo.find.mockResolvedValue([baseAssessment]);
      const result = await service.findAll();
      expect(result).toEqual([baseAssessment]);
      expect(mockAssessmentRepo.find).toHaveBeenCalledWith({ relations: ['questions'] });
    });
  });

  describe('findOne', () => {
    it('should return assessment by id', async () => {
      mockAssessmentRepo.findOne.mockResolvedValue(baseAssessment);
      const result = await service.findOne('assess-1');
      expect(result).toEqual(baseAssessment);
      expect(mockAssessmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'assess-1' },
        relations: ['questions'],
      });
    });
  });

  describe('findByIds', () => {
    it('should return empty array for empty ids', async () => {
      const result = await service.findByIds([]);
      expect(result).toEqual([]);
      expect(mockAssessmentRepo.findByIds).not.toHaveBeenCalled();
    });

    it('should return assessments for given ids', async () => {
      mockAssessmentRepo.findByIds.mockResolvedValue([baseAssessment]);
      const result = await service.findByIds(['assess-1']);
      expect(result).toEqual([baseAssessment]);
    });
  });

  describe('create', () => {
    it('should create and save an assessment', async () => {
      const data = { title: 'New Quiz', durationMinutes: 15 };
      mockAssessmentRepo.create.mockReturnValue(data);
      mockAssessmentRepo.save.mockResolvedValue({ id: 'new-1', ...data });

      const result = await service.create(data);

      expect(mockAssessmentRepo.create).toHaveBeenCalledWith(data);
      expect(result).toMatchObject({ id: 'new-1' });
    });

    it('should handle array result from save', async () => {
      const data = { title: 'Quiz' };
      mockAssessmentRepo.create.mockReturnValue(data);
      mockAssessmentRepo.save.mockResolvedValue([{ id: 'arr-1', ...data }]);

      const result = await service.create(data);
      expect(result).toMatchObject({ id: 'arr-1' });
    });
  });

  describe('update', () => {
    it('should update and return the assessment', async () => {
      const updated = { ...baseAssessment, title: 'Updated' };
      mockAssessmentRepo.update.mockResolvedValue({ affected: 1 });
      mockAssessmentRepo.findOne.mockResolvedValue(updated);

      const result = await service.update('assess-1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should soft-delete assessment and its questions in a transaction', async () => {
      mockAssessmentRepo.findOne.mockResolvedValue(baseAssessment);
      mockAssessmentRepo.manager.transaction.mockImplementation(async (cb) => {
        const manager = {
          getRepository: jest.fn().mockReturnValue({
            createQueryBuilder: jest.fn().mockReturnValue({
              softDelete: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              execute: jest.fn().mockResolvedValue({}),
            }),
            softDelete: jest.fn().mockResolvedValue({}),
          }),
        };
        await cb(manager);
      });

      await service.remove('assess-1');
      expect(mockAssessmentRepo.manager.transaction).toHaveBeenCalled();
    });

    it('should do nothing when assessment not found', async () => {
      mockAssessmentRepo.findOne.mockResolvedValue(null);
      await service.remove('nonexistent');
      expect(mockAssessmentRepo.manager.transaction).not.toHaveBeenCalled();
    });
  });

  describe('startAssessment', () => {
    it('should create an in-progress attempt', async () => {
      mockAssessmentRepo.findOne.mockResolvedValue(baseAssessment);
      mockAttemptRepo.save.mockResolvedValue({ id: 'attempt-1', status: AssessmentStatus.IN_PROGRESS });

      const result = await service.startAssessment('student-1', 'assess-1');

      expect(mockAttemptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'student-1',
          assessment: baseAssessment,
          status: AssessmentStatus.IN_PROGRESS,
        }),
      );
      expect(result).toMatchObject({ status: AssessmentStatus.IN_PROGRESS });
    });
  });

  describe('submitAssessment', () => {
    it('should throw NotFoundException when attempt not found', async () => {
      mockAttemptRepo.findOne.mockResolvedValue(null);
      await expect(service.submitAssessment('bad-attempt', [])).rejects.toThrow(NotFoundException);
    });

    it('should mark attempt as TIMED_OUT when past deadline', async () => {
      const pastAttempt = {
        id: 'attempt-1',
        startedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        assessment: { ...baseAssessment, durationMinutes: 1 },
        status: AssessmentStatus.IN_PROGRESS,
      };
      mockAttemptRepo.findOne.mockResolvedValue(pastAttempt);
      mockAttemptRepo.save.mockResolvedValue({ ...pastAttempt, status: AssessmentStatus.TIMED_OUT });

      const result = await service.submitAssessment('attempt-1', []);

      expect(mockAttemptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssessmentStatus.TIMED_OUT }),
      );
    });

    it('should grade attempt and return feedback', async () => {
      const activeAttempt = {
        id: 'attempt-1',
        startedAt: new Date(),
        assessment: { ...baseAssessment, durationMinutes: 60 },
        status: AssessmentStatus.IN_PROGRESS,
      };
      mockAttemptRepo.findOne.mockResolvedValue(activeAttempt);
      mockScoringService.calculate.mockReturnValue(10);
      mockFeedbackService.generate.mockReturnValue('Excellent performance 🎉');
      mockAnswerRepo.save.mockResolvedValue({});
      mockAttemptRepo.save.mockResolvedValue({ ...activeAttempt, score: 10, status: AssessmentStatus.GRADED });

      const result = await service.submitAssessment('attempt-1', [
        { questionId: 'q-1', response: 'A' },
      ]) as { attempt: any; feedback: string };

      expect(result.feedback).toBe('Excellent performance 🎉');
      expect(mockAttemptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssessmentStatus.GRADED, score: 10 }),
      );
    });
  });

  describe('getResults', () => {
    it('should return attempt with answers', async () => {
      const attempt = { id: 'attempt-1', answers: [] };
      mockAttemptRepo.findOne.mockResolvedValue(attempt);

      const result = await service.getResults('attempt-1');

      expect(mockAttemptRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'attempt-1' },
        relations: ['answers', 'answers.question'],
      });
      expect(result).toEqual(attempt);
    });
  });
});
