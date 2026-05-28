import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ManualReviewService } from './manual-review.service';
import { ReviewItem } from './review-item.entity';

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
};

describe('ManualReviewService', () => {
  let service: ManualReviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManualReviewService,
        { provide: getRepositoryToken(ReviewItem), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ManualReviewService>(ManualReviewService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueue', () => {
    it('should create and save a pending review item', async () => {
      const item = { content: 'bad content', safetyScore: 0.9, status: 'pending' };
      mockRepo.create.mockReturnValue(item);
      mockRepo.save.mockResolvedValue({ id: 1, ...item });

      await service.enqueue('bad content', 0.9);

      expect(mockRepo.create).toHaveBeenCalledWith({
        content: 'bad content',
        safetyScore: 0.9,
        status: 'pending',
      });
      expect(mockRepo.save).toHaveBeenCalledWith(item);
    });
  });

  describe('getQueue', () => {
    it('should return pending items ordered by safetyScore DESC then createdAt ASC', async () => {
      const items: Partial<ReviewItem>[] = [
        { id: 1, content: 'a', safetyScore: 0.9, status: 'pending' },
        { id: 2, content: 'b', safetyScore: 0.5, status: 'pending' },
      ];
      mockRepo.find.mockResolvedValue(items);

      const result = await service.getQueue();

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { status: 'pending' },
        order: { safetyScore: 'DESC', createdAt: 'ASC' },
      });
      expect(result).toEqual(items);
    });

    it('should return empty array when no pending items', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await service.getQueue();
      expect(result).toEqual([]);
    });
  });

  describe('markReviewed', () => {
    it('should update item status to reviewed', async () => {
      mockRepo.update.mockResolvedValue({ affected: 1 });

      await service.markReviewed(1);

      expect(mockRepo.update).toHaveBeenCalledWith(1, { status: 'reviewed' });
    });
  });
});
