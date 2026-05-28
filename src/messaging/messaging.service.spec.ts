import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { MessagingService } from './messaging.service';
import { TracingService } from './tracing/tracing.service';
import { QUEUE_NAMES } from '../common/constants/queue.constants';

const mockSpan = { end: jest.fn() };

const mockQueue = {
  add: jest.fn(),
  process: jest.fn(),
  getWaiting: jest.fn(),
  getActive: jest.fn(),
  getCompleted: jest.fn(),
  getFailed: jest.fn(),
};

const mockTracingService = {
  startSpan: jest.fn().mockReturnValue(mockSpan),
  endSpan: jest.fn(),
};

describe('MessagingService', () => {
  let service: MessagingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: getQueueToken(QUEUE_NAMES.MESSAGE_QUEUE), useValue: mockQueue },
        { provide: TracingService, useValue: mockTracingService },
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addMessageToQueue', () => {
    it('should add a message to the queue and return the job', async () => {
      const job = { id: 'job-1', data: { text: 'hello' } };
      mockQueue.add.mockResolvedValue(job);

      const result = await service.addMessageToQueue({ text: 'hello' });

      expect(mockQueue.add).toHaveBeenCalledWith({ text: 'hello' }, undefined);
      expect(result).toEqual(job);
      expect(mockTracingService.startSpan).toHaveBeenCalledWith('add-message-to-queue');
      expect(mockTracingService.endSpan).toHaveBeenCalledWith(mockSpan);
    });

    it('should pass options to the queue', async () => {
      const job = { id: 'job-2' };
      mockQueue.add.mockResolvedValue(job);

      await service.addMessageToQueue({ text: 'hi' }, { delay: 1000 });

      expect(mockQueue.add).toHaveBeenCalledWith({ text: 'hi' }, { delay: 1000 });
    });

    it('should end span even when queue.add throws', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(service.addMessageToQueue({ text: 'fail' })).rejects.toThrow('Queue error');
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
});
