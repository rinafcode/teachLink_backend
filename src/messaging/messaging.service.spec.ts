import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MessagingService } from './messaging.service';
import { TracingService } from './tracing/tracing.service';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { Message } from './message.entity';
import { PaginationService } from '../common/services/pagination.service';

const mockSpan = { end: jest.fn() };

const mockQueue = {
  add: jest.fn(),
  process: jest.fn(),
  getWaiting: jest.fn(),
  getActive: jest.fn(),
  getCompleted: jest.fn(),
  getFailed: jest.fn(),
};

const mockMessageRepo = {
  create: jest.fn((dto) => ({ ...dto, id: 'msg-1' })),
  save: jest.fn((msg) => Promise.resolve(msg)),
  find: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockResolvedValue(undefined),
  createQueryBuilder: jest.fn(),
};

const mockTracingService = {
  startSpan: jest.fn().mockReturnValue(mockSpan),
  endSpan: jest.fn(),
};

describe('MessagingService', () => {
  let service: MessagingService;

  beforeEach(async () => {
    const dataset = [
      {
        id: 'msg-1',
        senderId: 'user-1',
        recipientId: 'user-2',
        content: 'one',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'msg-2',
        senderId: 'user-2',
        recipientId: 'user-1',
        content: 'two',
        createdAt: new Date('2026-01-02T00:00:00Z'),
      },
      {
        id: 'msg-3',
        senderId: 'user-1',
        recipientId: 'user-2',
        content: 'three',
        createdAt: new Date('2026-01-03T00:00:00Z'),
      },
    ];

    mockMessageRepo.createQueryBuilder.mockImplementation(() => {
      let whereParams: any = null;
      let skipVal = 0;
      let takeVal = 20;
      const qb: any = {
        where: jest.fn().mockImplementation((_cond, params) => {
          whereParams = params;
          return qb;
        }),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockImplementation((val) => {
          skipVal = val;
          return qb;
        }),
        take: jest.fn().mockImplementation((val) => {
          takeVal = val;
          return qb;
        }),
        getManyAndCount: jest.fn().mockImplementation(async () => {
          const items = dataset.filter(
            (item) =>
              (item.senderId === whereParams.userId && item.recipientId === whereParams.otherUserId) ||
              (item.senderId === whereParams.otherUserId && item.recipientId === whereParams.userId),
          );
          return [items.slice(skipVal, skipVal + takeVal), items.length];
        }),
      };
      return qb;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: getQueueToken(QUEUE_NAMES.MESSAGE_QUEUE), useValue: mockQueue },
        { provide: TracingService, useValue: mockTracingService },
        { provide: getRepositoryToken(Message), useValue: mockMessageRepo },
        PaginationService,
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMessage', () => {
    it('should create a message and add it to the queue', async () => {
      const dto = { text: 'hello' };
      const saved = { ...dto, id: 'msg-1', readAt: null };
      mockMessageRepo.save.mockResolvedValue(saved);
      mockQueue.add.mockResolvedValue({ id: 'job-1', data: saved });

      const result = await service.createMessage(dto as any);

      expect(mockMessageRepo.create).toHaveBeenCalled();
      expect(mockMessageRepo.save).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalled();
      expect(result).toEqual(saved);
      expect(mockTracingService.startSpan).toHaveBeenCalledWith('create-message');
      expect(mockTracingService.endSpan).toHaveBeenCalledWith(mockSpan);
    });

    it('should throw when save fails', async () => {
      mockMessageRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.createMessage({ text: 'fail' } as any)).rejects.toThrow('DB error');
      expect(mockTracingService.endSpan).toHaveBeenCalledWith(mockSpan);
    });
  });

  describe('processMessages', () => {
    it('should register a queue processor', async () => {
      await service.processMessages();
      expect(mockQueue.process).toHaveBeenCalled();
    });
  });

  describe('getQueueStatus', () => {
    it('should return counts for all queue states', async () => {
      mockQueue.getWaiting.mockResolvedValue([{}, {}]);
      mockQueue.getActive.mockResolvedValue([{}]);
      mockQueue.getCompleted.mockResolvedValue([{}, {}, {}]);
      mockQueue.getFailed.mockResolvedValue([]);

      const status = await service.getQueueStatus();

      expect(status).toEqual({ waiting: 2, active: 1, completed: 3, failed: 0 });
    });
  });

  describe('getConversation', () => {
    it('should paginate conversation results and clamp the page size', async () => {
      const result = await service.getConversation('user-1', 'user-2', {
        page: 1,
        limit: 999,
      } as any);

      expect(result.limit).toBe(100);
      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
    });
  });
});
