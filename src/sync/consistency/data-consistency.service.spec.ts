import { Test, TestingModule } from '@nestjs/testing';
import { DataConsistencyService } from './data-consistency.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bull';

describe('DataConsistencyService', () => {
  let service: DataConsistencyService;
  let eventEmitter: EventEmitter2;
  let queue: any;

  beforeEach(async () => {
    const mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataConsistencyService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: getQueueToken('sync-tasks'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<DataConsistencyService>(DataConsistencyService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    queue = module.get(getQueueToken('sync-tasks'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scheduleConsistencyTask', () => {
    it('should add task to queue and emit event', async () => {
      await service.scheduleConsistencyTask('1', { foo: 'bar' });
      expect(queue.add).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('data.consistency.scheduled', expect.any(Object));
    });
  });

  describe('performIntegrityCheck', () => {
    it('should return consistent when data matches', async () => {
      const result = await service.performIntegrityCheck({ id: '1', version: 1 }, { id: '1', version: 1 });
      expect(result.consistent).toBe(true);
    });

    it('should return issues when IDs mismatch', async () => {
      const result = await service.performIntegrityCheck({ id: '1' }, { id: '2' });
      expect(result.consistent).toBe(false);
      expect(result.issues).toContain('ID mismatch: 1 vs 2');
    });
  });
});
