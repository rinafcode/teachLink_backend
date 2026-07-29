import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bull';
import { ReplicationService } from './replication.service';
import { QUEUE_NAMES } from '../../common/constants/queue.constants';

const mockQueue = { add: jest.fn() };
const mockEventEmitter = { emit: jest.fn() };

function buildModule(region: string, replicationRegions: string): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      ReplicationService,
      {
        provide: ConfigService,
        useValue: {
          getOrThrow: jest.fn((key: string) => {
            if (key === 'REGION') return region;
            if (key === 'REPLICATION_REGIONS') return replicationRegions;
            throw new Error(`Unknown config key: ${key}`);
          }),
        },
      },
      { provide: EventEmitter2, useValue: mockEventEmitter },
      { provide: getQueueToken(QUEUE_NAMES.SYNC_TASKS), useValue: mockQueue },
    ],
  }).compile();
}

describe('ReplicationService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws on init when current region is absent from REPLICATION_REGIONS', async () => {
    const module = await buildModule('ap-northeast-1', 'us-east-1,eu-west-1,ap-southeast-1');
    const service = module.get(ReplicationService);
    expect(() => service.onModuleInit()).toThrow(
      'REGION "ap-northeast-1" is not present in REPLICATION_REGIONS',
    );
  });

  it('enqueues no jobs for a region absent from configuration', async () => {
    const module = await buildModule('us-east-1', 'us-east-1,eu-west-1');
    const service = module.get(ReplicationService);
    service.onModuleInit();

    await service.broadcastToAllRegions('entity-1', { foo: 'bar' });

    // Only eu-west-1 should receive a job; ap-southeast-1 is not in config
    expect(mockQueue.add).toHaveBeenCalledTimes(1);
    const jobData = mockQueue.add.mock.calls[0][1];
    expect(jobData.targetRegion).toBe('eu-west-1');
  });

  it('initialises successfully when current region is in topology', async () => {
    const module = await buildModule('eu-west-1', 'us-east-1,eu-west-1,ap-southeast-1');
    const service = module.get(ReplicationService);
    expect(() => service.onModuleInit()).not.toThrow();
  });
});
