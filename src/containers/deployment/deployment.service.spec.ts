import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { DeploymentService } from './deployment.service';
import { Container } from '../entities/container.entity';

const mockContainerRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
});

const mockQueue = {
  add: jest.fn(),
};

describe('DeploymentService', () => {
  let deploymentService: DeploymentService;
  let containerRepository;
  let deploymentQueue;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.registerQueue({ name: 'deployment-management' }),
      ],
      providers: [
        DeploymentService,
        {
          provide: getRepositoryToken(Container),
          useFactory: mockContainerRepository,
        },
        {
          provide: getQueueToken('deployment-management'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    deploymentService = module.get<DeploymentService>(DeploymentService);
    containerRepository = module.get<Repository<Container>>(getRepositoryToken(Container));
    deploymentQueue = module.get<Queue>(getQueueToken('deployment-management'));
  });

  describe('deployNewVersion', () => {
    it('should deploy a new version of the container', async () => {
      containerRepository.findOne.mockResolvedValue({ id: 'container-id', name: 'test-container', imageTag: 'v1' });
      await deploymentService.deployNewVersion('container-id', 'v2');
      expect(containerRepository.save).toHaveBeenCalledWith({ id: 'container-id', name: 'test-container', imageTag: 'v2' });
      expect(deploymentQueue.add).toHaveBeenCalledWith('deploy-version', { containerId: 'container-id', newImageTag: 'v2' });
    });
  });
});

