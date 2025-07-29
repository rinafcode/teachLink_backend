import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { AutoScalingService } from './auto-scaling.service';
import { Container } from '../entities/container.entity';

const mockContainerRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
});

const mockQueue = {
  add: jest.fn(),
};

const containerId = 'container-id-mock';

describe('AutoScalingService', () => {
  let autoScalingService: AutoScalingService;
  let containerRepository;
  let scalingQueue;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.registerQueue({ name: 'auto-scaling' }),
      ],
      providers: [
        AutoScalingService,
        {
          provide: getRepositoryToken(Container),
          useFactory: mockContainerRepository,
        },
        {
          provide: getQueueToken('auto-scaling'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    autoScalingService = module.get<AutoScalingService>(AutoScalingService);
    containerRepository = module.get<Repository<Container>>(getRepositoryToken(Container));
    scalingQueue = module.get<Queue>(getQueueToken('auto-scaling'));
  });

  describe('scaleUp', () => {
    it('should scale up the container', async () => {
      containerRepository.findOne.mockResolvedValue({ id: containerId, replicas: 1, name: 'test-container' });
      await autoScalingService.scaleUp(containerId);
      expect(containerRepository.save).toHaveBeenCalledWith({ id: containerId, replicas: 2, name: 'test-container' });
      expect(scalingQueue.add).toHaveBeenCalledWith('scale-up', { containerId });
    });
  });

  describe('scaleDown', () => {
    it('should scale down the container', async () => {
      containerRepository.findOne.mockResolvedValue({ id: containerId, replicas: 2, name: 'test-container' });
      await autoScalingService.scaleDown(containerId);
      expect(containerRepository.save).toHaveBeenCalledWith({ id: containerId, replicas: 1, name: 'test-container' });
      expect(scalingQueue.add).toHaveBeenCalledWith('scale-down', { containerId });
    });
  });
});

