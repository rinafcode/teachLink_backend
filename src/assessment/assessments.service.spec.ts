import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { Assessment } from './entities/assessment.entity';
import { AssessmentAttempt } from './entities/assessment-attempt.entity';
import { Answer } from './entities/answer.entity';
import { FeedbackGenerationService } from './feedback/feedback-generation.service';
import { ScoreCalculationService } from './scoring/score-calculation.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AssessmentStatus } from './enums/assessment-status.enum';
import { QuestionType } from './enums/question-type.enum';

// ─── Factories ────────────────────────────────────────────────────────────────

const makeAssessment = (overrides: Partial<typeof BASE_ASSESSMENT> = {}) => ({
  id: 'assess-1',
  title: 'JS Basics',
  durationMinutes: 30,
  questions: [
    { id: 'q-1', type: QuestionType.MULTIPLE_CHOICE, correctAnswer: 'A', points: 10 },
    { id: 'q-2', type: QuestionType.MULTIPLE_CHOICE, correctAnswer: 'B', points: 5 },
  ],
  ...overrides,
});

const makeAttempt = (overrides: Record<string, any> = {}) => ({
  id: 'attempt-1',
  studentId: 'student-1',
  startedAt: new Date(),
  status: AssessmentStatus.IN_PROGRESS,
  assessment: makeAssessment(),
  ...overrides,
});

// Convenience alias for tests that don't need to inspect the shape
const BASE_ASSESSMENT = makeAssessment();

// ─── Mock factories (fresh per test via beforeEach) ───────────────────────────

const makeMockAssessmentRepo = () => ({
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
});

const makeMockAttemptRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
});

const makeMockAnswerRepo = () => ({
  save: jest.fn(),
});

const makeMockScoringService = () => ({
  calculate: jest.fn(),
});

const makeMockFeedbackService = () => ({
  generate: jest.fn(),
});

const makeMockAnalyticsService = () => ({
  recordAssessmentStarted: jest.fn(),
  recordAssessmentSubmitted: jest.fn(),
  recordAssessmentTimedOut: jest.fn(),
  recordAssessmentScore: jest.fn(),
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AssessmentsService', () => {
  let service: AssessmentsService;
  let assessmentRepo: ReturnType<typeof makeMockAssessmentRepo>;
  let attemptRepo: ReturnType<typeof makeMockAttemptRepo>;
  let answerRepo: ReturnType<typeof makeMockAnswerRepo>;
  let scoringService: ReturnType<typeof makeMockScoringService>;
  let feedbackService: ReturnType<typeof makeMockFeedbackService>;
  let analyticsService: ReturnType<typeof makeMockAnalyticsService>;

  beforeEach(async () => {
    assessmentRepo = makeMockAssessmentRepo();
    attemptRepo = makeMockAttemptRepo();
    answerRepo = makeMockAnswerRepo();
    scoringService = makeMockScoringService();
    feedbackService = makeMockFeedbackService();
    analyticsService = makeMockAnalyticsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        { provide: getRepositoryToken(Assessment), useValue: assessmentRepo },
        { provide: getRepositoryToken(AssessmentAttempt), useValue: attemptRepo },
        { provide: getRepositoryToken(Answer), useValue: answerRepo },
        { provide: ScoreCalculationService, useValue: scoringService },
        { provide: FeedbackGenerationService, useValue: feedbackService },
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    }).compile();

    service = module.get<AssessmentsService>(AssessmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all assessments with questions relation', async () => {
      assessmentRepo.find.mockResolvedValue([BASE_ASSESSMENT]);

      const result = await service.findAll();

      expect(result).toEqual([BASE_ASSESSMENT]);
      expect(assessmentRepo.find).toHaveBeenCalledWith({ relations: ['questions'] });
    });

    it('returns empty array when no assessments exist', async () => {
      assessmentRepo.find.mockResolvedValue([]);
      expect(await service.findAll()).toEqual([]);
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns assessment by id with questions relation', async () => {
      assessmentRepo.findOne.mockResolvedValue(BASE_ASSESSMENT);

      const result = await service.findOne('assess-1');

      expect(result).toEqual(BASE_ASSESSMENT);
      expect(assessmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'assess-1' },
        relations: ['questions'],
      });
    });

    it('returns null when assessment does not exist', async () => {
      assessmentRepo.findOne.mockResolvedValue(null);
      expect(await service.findOne('unknown')).toBeNull();
    });
  });

  // ── findByIds ────────────────────────────────────────────────────────────

  describe('findByIds', () => {
    it('short-circuits and returns [] without hitting the repo for empty input', async () => {
      const result = await service.findByIds([]);
      expect(result).toEqual([]);
      expect(assessmentRepo.findByIds).not.toHaveBeenCalled();
    });

    it('returns assessments for given ids', async () => {
      assessmentRepo.findByIds.mockResolvedValue([BASE_ASSESSMENT]);
      const result = await service.findByIds(['assess-1']);
      expect(result).toEqual([BASE_ASSESSMENT]);
    });
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and saves an assessment', async () => {
      const data = { title: 'New Quiz', durationMinutes: 15 };
      assessmentRepo.create.mockReturnValue(data);
      assessmentRepo.save.mockResolvedValue({ id: 'new-1', ...data });

      const result = await service.create(data);

      expect(assessmentRepo.create).toHaveBeenCalledWith(data);
      expect(result).toMatchObject({ id: 'new-1', title: 'New Quiz' });
    });

    it('unwraps array result from save (TypeORM bulk-save edge case)', async () => {
      const data = { title: 'Quiz' };
      assessmentRepo.create.mockReturnValue(data);
      assessmentRepo.save.mockResolvedValue([{ id: 'arr-1', ...data }]);

      const result = await service.create(data);
      expect(result).toMatchObject({ id: 'arr-1' });
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates the record and returns the refreshed assessment', async () => {
      const updated = makeAssessment({ title: 'Updated' });
      assessmentRepo.update.mockResolvedValue({ affected: 1 });
      assessmentRepo.findOne.mockResolvedValue(updated);

      const result = await service.update('assess-1', { title: 'Updated' });

      expect(assessmentRepo.update).toHaveBeenCalledWith('assess-1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes assessment and questions inside a transaction', async () => {
      assessmentRepo.findOne.mockResolvedValue(BASE_ASSESSMENT);

      const qbMock = {
        softDelete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      const softDeleteMock = jest.fn().mockResolvedValue({});
      const getRepositoryMock = jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(qbMock),
        softDelete: softDeleteMock,
      });

      assessmentRepo.manager.transaction.mockImplementation(async (cb: any) => {
        await cb({ getRepository: getRepositoryMock });
      });

      await service.remove('assess-1');

      expect(assessmentRepo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(qbMock.execute).toHaveBeenCalled();
      expect(softDeleteMock).toHaveBeenCalledWith('assess-1');
    });

    it('skips the transaction when assessment does not exist', async () => {
      assessmentRepo.findOne.mockResolvedValue(null);
      await service.remove('nonexistent');
      expect(assessmentRepo.manager.transaction).not.toHaveBeenCalled();
    });
  });

  // ── startAssessment ──────────────────────────────────────────────────────

  describe('startAssessment', () => {
    it('saves an IN_PROGRESS attempt and records the analytics event', async () => {
      assessmentRepo.findOne.mockResolvedValue(BASE_ASSESSMENT);
      attemptRepo.save.mockResolvedValue({
        id: 'attempt-1',
        status: AssessmentStatus.IN_PROGRESS,
      });

      const result = await service.startAssessment('student-1', 'assess-1');

      expect(attemptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'student-1',
          assessment: BASE_ASSESSMENT,
          status: AssessmentStatus.IN_PROGRESS,
        }),
      );
      expect(result.status).toBe(AssessmentStatus.IN_PROGRESS);
      expect(analyticsService.recordAssessmentStarted).toHaveBeenCalledWith('assess-1');
    });
  });

  // ── submitAssessment ─────────────────────────────────────────────────────

  describe('submitAssessment', () => {
    it('throws NotFoundException when attempt is not found', async () => {
      attemptRepo.findOne.mockResolvedValue(null);
      await expect(service.submitAssessment('missing', [])).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when attempt has no questions', async () => {
      attemptRepo.findOne.mockResolvedValue(
        makeAttempt({ assessment: { ...makeAssessment(), questions: undefined } }),
      );
      await expect(service.submitAssessment('attempt-1', [])).rejects.toThrow(NotFoundException);
    });

    it('marks attempt TIMED_OUT and fires timeout analytics when past deadline', async () => {
      const timedOutAttempt = makeAttempt({
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        assessment: makeAssessment({ durationMinutes: 1 }),
      });
      attemptRepo.findOne.mockResolvedValue(timedOutAttempt);
      attemptRepo.save.mockResolvedValue({ ...timedOutAttempt, status: AssessmentStatus.TIMED_OUT });

      await service.submitAssessment('attempt-1', []);

      expect(attemptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssessmentStatus.TIMED_OUT }),
      );
      expect(analyticsService.recordAssessmentTimedOut).toHaveBeenCalledWith(
        timedOutAttempt.assessment.id,
        timedOutAttempt.startedAt,
      );
      expect(analyticsService.recordAssessmentSubmitted).not.toHaveBeenCalled();
    });

    it('grades all questions, saves answers, and returns feedback', async () => {
      const activeAttempt = makeAttempt({
        assessment: makeAssessment({ durationMinutes: 60 }),
      });
      attemptRepo.findOne.mockResolvedValue(activeAttempt);
      scoringService.calculate.mockReturnValue(10);
      feedbackService.generate.mockReturnValue('Excellent');
      answerRepo.save.mockResolvedValue({});
      attemptRepo.save.mockResolvedValue({
        ...activeAttempt,
        score: 20,
        status: AssessmentStatus.GRADED,
      });

      const result = (await service.submitAssessment('attempt-1', [
        { questionId: 'q-1', response: 'A' },
        { questionId: 'q-2', response: 'B' },
      ])) as { attempt: any; feedback: string };

      // One saved answer per question
      expect(answerRepo.save).toHaveBeenCalledTimes(2);
      expect(answerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ question: activeAttempt.assessment.questions[0], response: 'A', awardedPoints: 10 }),
      );

      expect(attemptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AssessmentStatus.GRADED, score: 20 }),
      );
      expect(result.feedback).toBe('Excellent');
    });

    it('records submission and score analytics on successful grade', async () => {
      const activeAttempt = makeAttempt({
        assessment: makeAssessment({ durationMinutes: 60 }),
      });
      attemptRepo.findOne.mockResolvedValue(activeAttempt);
      // q-1 = 10pts correct, q-2 = 0pts wrong → score 10 out of 15
      scoringService.calculate
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(0);
      feedbackService.generate.mockReturnValue('Good job');
      answerRepo.save.mockResolvedValue({});
      attemptRepo.save.mockResolvedValue({ ...activeAttempt, score: 10, status: AssessmentStatus.GRADED });

      await service.submitAssessment('attempt-1', []);

      expect(analyticsService.recordAssessmentSubmitted).toHaveBeenCalledWith(
        activeAttempt.assessment.id,
        activeAttempt.startedAt,
      );
      expect(analyticsService.recordAssessmentScore).toHaveBeenCalledWith(10, 15);
    });

    it('handles all questions unanswered (score of 0)', async () => {
      const activeAttempt = makeAttempt({
        assessment: makeAssessment({ durationMinutes: 60 }),
      });
      attemptRepo.findOne.mockResolvedValue(activeAttempt);
      scoringService.calculate.mockReturnValue(0);
      feedbackService.generate.mockReturnValue('Keep practising');
      answerRepo.save.mockResolvedValue({});
      attemptRepo.save.mockResolvedValue({ ...activeAttempt, score: 0, status: AssessmentStatus.GRADED });

      const result = (await service.submitAssessment('attempt-1', [])) as { attempt: any; feedback: string };

      expect(attemptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ score: 0, status: AssessmentStatus.GRADED }),
      );
      expect(feedbackService.generate).toHaveBeenCalledWith(0, 15);
      expect(result.feedback).toBe('Keep practising');
    });
  });

  // ── getResults ───────────────────────────────────────────────────────────

  describe('getResults', () => {
    it('returns attempt with answers and nested question relations', async () => {
      const attempt = { id: 'attempt-1', answers: [{ id: 'ans-1', question: { id: 'q-1' } }] };
      attemptRepo.findOne.mockResolvedValue(attempt);

      const result = await service.getResults('attempt-1');

      expect(attemptRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'attempt-1' },
        relations: ['answers', 'answers.question'],
      });
      expect(result).toEqual(attempt);
    });

    it('returns null when attempt does not exist', async () => {
      attemptRepo.findOne.mockResolvedValue(null);
      expect(await service.getResults('unknown')).toBeNull();
    });
  });
});