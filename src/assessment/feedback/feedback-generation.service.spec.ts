import { Test, TestingModule } from '@nestjs/testing';
import { FeedbackGenerationService } from './feedback-generation.service';

describe('FeedbackGenerationService', () => {
  let service: FeedbackGenerationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeedbackGenerationService],
    }).compile();

    service = module.get<FeedbackGenerationService>(FeedbackGenerationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('should return excellent feedback for score >= 80%', () => {
      expect(service.generate(80, 100)).toBe('Excellent performance 🎉');
      expect(service.generate(100, 100)).toBe('Excellent performance 🎉');
      expect(service.generate(9, 10)).toBe('Excellent performance 🎉');
    });

    it('should return good feedback for score between 50% and 79%', () => {
      expect(service.generate(50, 100)).toBe('Good job, but there is room to improve 👍');
      expect(service.generate(79, 100)).toBe('Good job, but there is room to improve 👍');
      expect(service.generate(6, 10)).toBe('Good job, but there is room to improve 👍');
    });

    it('should return keep practicing feedback for score < 50%', () => {
      expect(service.generate(0, 100)).toBe('Keep practicing, you can do better 💪');
      expect(service.generate(49, 100)).toBe('Keep practicing, you can do better 💪');
      expect(service.generate(1, 10)).toBe('Keep practicing, you can do better 💪');
    });

    it('should handle edge case of exactly 80%', () => {
      expect(service.generate(8, 10)).toBe('Excellent performance 🎉');
    });

    it('should handle edge case of exactly 50%', () => {
      expect(service.generate(5, 10)).toBe('Good job, but there is room to improve 👍');
    });
  });
});
