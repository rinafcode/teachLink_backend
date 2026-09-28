import { Test, TestingModule } from '@nestjs/testing';
import { ScoreCalculationService } from './score-calculation.service';
import { QuestionType } from '../enums/question-type.enum';
import { Question } from '../entities/question.entity';

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    version: 1,
    type: QuestionType.MULTIPLE_CHOICE,
    prompt: 'What is 2+2?',
    options: ['2', '3', '4', '5'],
    correctAnswer: '4',
    points: 10,
    assessment: null as any,
    ...overrides,
  };
}

describe('ScoreCalculationService', () => {
  let service: ScoreCalculationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScoreCalculationService],
    }).compile();

    service = module.get<ScoreCalculationService>(ScoreCalculationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculate — MULTIPLE_CHOICE', () => {
    it('should award full points for correct answer', () => {
      const q = makeQuestion({
        type: QuestionType.MULTIPLE_CHOICE,
        correctAnswer: '4',
        points: 10,
      });
      expect(service.calculate(q, '4')).toBe(10);
    });

    it('should award 0 for wrong answer', () => {
      const q = makeQuestion({
        type: QuestionType.MULTIPLE_CHOICE,
        correctAnswer: '4',
        points: 10,
      });
      expect(service.calculate(q, '3')).toBe(0);
    });

    it('should award 0 for null response', () => {
      const q = makeQuestion({
        type: QuestionType.MULTIPLE_CHOICE,
        correctAnswer: '4',
        points: 10,
      });
      expect(service.calculate(q, null)).toBe(0);
    });
  });

  describe('calculate — TRUE_FALSE', () => {
    it('should award full points for correct true/false answer', () => {
      const q = makeQuestion({ type: QuestionType.TRUE_FALSE, correctAnswer: true, points: 5 });
      expect(service.calculate(q, true)).toBe(5);
    });

    it('should award 0 for wrong true/false answer', () => {
      const q = makeQuestion({ type: QuestionType.TRUE_FALSE, correctAnswer: true, points: 5 });
      expect(service.calculate(q, false)).toBe(0);
    });
  });

  describe('calculate — CODING', () => {
    it('should award full points when tests pass', () => {
      const q = makeQuestion({ type: QuestionType.CODING, points: 20 });
      expect(service.calculate(q, { passed: true })).toBe(20);
    });

    it('should award 0 when tests fail', () => {
      const q = makeQuestion({ type: QuestionType.CODING, points: 20 });
      expect(service.calculate(q, { passed: false })).toBe(0);
    });

    it('should award 0 for null coding response', () => {
      const q = makeQuestion({ type: QuestionType.CODING, points: 20 });
      expect(service.calculate(q, null)).toBe(0);
    });
  });

  describe('calculate — unknown type', () => {
    it('should return 0 for unrecognised question type', () => {
      const q = makeQuestion({ type: 'essay' as QuestionType, points: 15 });
      expect(service.calculate(q, 'some answer')).toBe(0);
    });
  });
});
