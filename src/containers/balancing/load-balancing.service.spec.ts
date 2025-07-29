import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { LoadBalancingService } from './load-balancing.service';
import { Container } from '../entities/container.entity';

const mockContainerRepository = () => ({
  findByIds: jest.fn(),
});

const mockQueue = {
  add: jest.fn(),
};

describe('LoadBalancingService', () => {
  let loadBalancingService: LoadBalancingService;
  let containerRepository;
  let balancingQueue;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.registerQueue({ name: 'load-balancing' }),
      ],
      providers: [
        LoadBalancingService,
        {
          provide: getRepositoryToken(Container),
          useFactory: mockContainerRepository,
        },
        {
          provide: getQueueToken('load-balancing'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    loadBalancingService = module.get<LoadBalancingService>(LoadBalancingService);
    containerRepository = module.get<Repository<Container>>(getRepositoryToken(Container));
    balancingQueue = module.get<Queue>(getQueueToken('load-balancing'));
  });

  describe('balanceTraffic', () => {
    it('should balance traffic among containers', async () => {
      containerRepository.findByIds.mockResolvedValue([]); // Mocked empty for simplicity
      await loadBalancingService.balanceTraffic(['container-1', 'container-2']);
      expect(balancingQueue.add).toHaveBeenCalledWith('balance-traffic', { containerIds: ['container-1', 'container-2'] });
    });
  });
});

