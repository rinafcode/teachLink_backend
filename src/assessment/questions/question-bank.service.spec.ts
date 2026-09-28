import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionBankService } from './question-bank.service';
import { Question } from '../entities/question.entity';

describe('QuestionBankService', () => {
  let service: QuestionBankService;
  let repo: jest.Mocked<Repository<Question>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionBankService,
        {
          provide: getRepositoryToken(Question),
          useValue: {
            save: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QuestionBankService>(QuestionBankService);
    repo = module.get(getRepositoryToken(Question));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('saves and returns the question on success', async () => {
      const input = { text: 'What is 2+2?' } as Partial<Question>;
      const saved = { id: 'q1', ...input } as Question;
      repo.save.mockResolvedValue(saved);

      const result = await service.create(input);

      expect(repo.save).toHaveBeenCalledWith(input);
      expect(result).toBe(saved);
    });

    it('propagates a repository failure', async () => {
      const error = new Error('db unavailable');
      repo.save.mockRejectedValue(error);

      await expect(service.create({})).rejects.toThrow(error);
    });
  });

  describe('findByAssessment', () => {
    it('returns a paginated response built from the repository result', async () => {
      const questions = [{ id: 'q1' }, { id: 'q2' }] as Question[];
      repo.findAndCount.mockResolvedValue([questions, 25]);

      const result = await service.findByAssessment('assessment-1', 2, 10);

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { assessment: { id: 'assessment-1' } },
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
      expect(result).toEqual({
        data: questions,
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      });
    });

    it('defaults to page 1 and limit 10 when not provided', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByAssessment('assessment-1');

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it('propagates a repository failure', async () => {
      const error = new Error('query failed');
      repo.findAndCount.mockRejectedValue(error);

      await expect(service.findByAssessment('assessment-1')).rejects.toThrow(error);
    });
  });
});
