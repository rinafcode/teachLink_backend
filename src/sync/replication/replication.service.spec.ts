import { Test, TestingModule } from '@nestjs/testing';
import { ReplicationService } from './replication.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bull';

describe('ReplicationService', () => {
  let service: ReplicationService;
  let eventEmitter: EventEmitter2;
  let queue: any;

  beforeEach(async () => {
    const mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplicationService,
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

    service = module.get<ReplicationService>(ReplicationService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    queue = module.get(getQueueToken('sync-tasks'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('replicateToRegion', () => {
    it('should add replication task to queue', async () => {
      await service.replicateToRegion('1', { foo: 'bar' }, 'eu-west-1');
      expect(queue.add).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('data.replication.started', expect.any(Object));
    });

    it('should skip if target region is same as current', async () => {
      // currentRegion defaults to us-east-1 in implementation if not set
      await service.replicateToRegion('1', { foo: 'bar' }, 'us-east-1');
      expect(queue.add).not.toHaveBeenCalled();
    });
  });
});
