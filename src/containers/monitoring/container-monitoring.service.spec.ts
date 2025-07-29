import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { ContainerMonitoringService } from './container-monitoring.service';
import { Container } from '../entities/container.entity';

const mockContainerRepository = () = ({
  findOne: jest.fn(),
});

const mockQueue = {
  add: jest.fn(),
};

describe('ContainerMonitoringService', () = {
  let monitoringService: ContainerMonitoringService;
  let containerRepository;
  let monitoringQueue;

  beforeEach(async () = {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.registerQueue({ name: 'container-monitoring' }),
      ],
      providers: [
        ContainerMonitoringService,
        {
          provide: getRepositoryToken(Container),
          useFactory: mockContainerRepository,
        },
        {
          provide: getQueueToken('container-monitoring'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    monitoringService = module.get<ContainerMonitoringService>(ContainerMonitoringService);
    containerRepository = module.get<Repository<Container>>(getRepositoryToken(Container));
    monitoringQueue = module.get<Queue>(getQueueToken('container-monitoring'));
  });

  describe('checkContainerHealth', () = {
    it('should check container health', async () = {
      containerRepository.findOne.mockResolvedValue({ id: 'container-id', name: 'test-container' });
      await monitoringService.checkContainerHealth('container-id');
      expect(monitoringQueue.add).toHaveBeenCalledWith('health-check', { containerId: 'container-id', isHealthy: true });
    });
  });
});

