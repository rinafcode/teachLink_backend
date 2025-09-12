import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { AutoScalingService } from './auto-scaling.service';
import { Container } from '../entities/container.entity';
import {
  ScalingOperationException,
  ContainerNotFoundException,
  DeploymentFailedException,
} from '../../common/exceptions/custom-exceptions';
import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';
import { DistributedTracingService } from '../../observability/tracing/distributed-tracing.service';

describe('AutoScalingService', () => {
  let service: AutoScalingService;
  let containerRepository: any;
  let scalingQueue: any;
  let metricsService: any;
  let tracingService: any;

  const mockContainer: Partial<Container> = {
    id: 'test-container-id',
    name: 'test-container',
    replicas: 2,
    status: 'running',
    image: 'test-image',
    tag: 'latest',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoScalingService,
        {
          provide: getRepositoryToken(Container),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getQueueToken('auto-scaling'),
          useValue: {
            add: jest.fn(),
          },
        },
        {
          provide: MetricsCollectionService,
          useValue: {
            recordCustomMetric: jest.fn(),
          },
        },
        {
          provide: DistributedTracingService,
          useValue: {
            startSpan: jest.fn(),
            endSpan: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AutoScalingService>(AutoScalingService);
    containerRepository = module.get(getRepositoryToken(Container));
    scalingQueue = module.get(getQueueToken('auto-scaling'));
    metricsService = module.get(MetricsCollectionService);
    tracingService = module.get(DistributedTracingService);
  });

  describe('scaleUp', () => {
    it('should successfully scale up a container', async () => {
      const containerId = 'test-container-id';
      const mockContainerWithReplicas = { ...mockContainer, replicas: 2 };

      containerRepository.findOne.mockResolvedValue(mockContainerWithReplicas);
      containerRepository.save.mockResolvedValue({
        ...mockContainerWithReplicas,
        replicas: 3,
      });
      scalingQueue.add.mockResolvedValue({ id: 'job-id' });

      await service.scaleUp(containerId);

      expect(containerRepository.findOne).toHaveBeenCalledWith({
        where: { id: containerId },
      });
      expect(containerRepository.save).toHaveBeenCalledWith({
        ...mockContainerWithReplicas,
        replicas: 3,
      });
      expect(scalingQueue.add).toHaveBeenCalledWith('scale-up', {
        containerId,
      });
      expect(metricsService.recordCustomMetric).toHaveBeenCalledWith(
        'scale_up_operations',
        1,
      );
    });

    it('should throw ScalingOperationException when containerId is empty', async () => {
      await expect(service.scaleUp('')).rejects.toThrow(
        ScalingOperationException,
      );
    });

    it('should throw ContainerNotFoundException when container not found', async () => {
      containerRepository.findOne.mockResolvedValue(null);

      await expect(service.scaleUp('non-existent-id')).rejects.toThrow(
        ContainerNotFoundException,
      );
    });

    it('should throw ScalingOperationException when maximum replicas reached', async () => {
      const containerWithMaxReplicas = { ...mockContainer, replicas: 10 };
      containerRepository.findOne.mockResolvedValue(containerWithMaxReplicas);

      await expect(service.scaleUp('test-container-id')).rejects.toThrow(
        ScalingOperationException,
      );
    });

    it('should throw DeploymentFailedException when database save fails', async () => {
      containerRepository.findOne.mockResolvedValue(mockContainer);
      containerRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.scaleUp('test-container-id')).rejects.toThrow(
        DeploymentFailedException,
      );
    });

    it('should record error metrics when scaling fails', async () => {
      containerRepository.findOne.mockResolvedValue(mockContainer);
      containerRepository.save.mockRejectedValue(new Error('Database error'));

      try {
        await service.scaleUp('test-container-id');
      } catch (error) {
        // Expected to throw
      }

      expect(metricsService.recordCustomMetric).toHaveBeenCalledWith(
        'scaling_operation_failures',
        1,
      );
      expect(metricsService.recordCustomMetric).toHaveBeenCalledWith(
        'scale_up_failures',
        1,
      );
    });
  });

  describe('scaleDown', () => {
    it('should successfully scale down a container', async () => {
      const containerId = 'test-container-id';
      const mockContainerWithReplicas = { ...mockContainer, replicas: 3 };

      containerRepository.findOne.mockResolvedValue(mockContainerWithReplicas);
      containerRepository.save.mockResolvedValue({
        ...mockContainerWithReplicas,
        replicas: 2,
      });
      scalingQueue.add.mockResolvedValue({ id: 'job-id' });

      await service.scaleDown(containerId);

      expect(containerRepository.findOne).toHaveBeenCalledWith({
        where: { id: containerId },
      });
      expect(containerRepository.save).toHaveBeenCalledWith({
        ...mockContainerWithReplicas,
        replicas: 2,
      });
      expect(scalingQueue.add).toHaveBeenCalledWith('scale-down', {
        containerId,
      });
      expect(metricsService.recordCustomMetric).toHaveBeenCalledWith(
        'scale_down_operations',
        1,
      );
    });

    it('should throw ScalingOperationException when containerId is empty', async () => {
      await expect(service.scaleDown('')).rejects.toThrow(
        ScalingOperationException,
      );
    });

    it('should throw ContainerNotFoundException when container not found', async () => {
      containerRepository.findOne.mockResolvedValue(null);

      await expect(service.scaleDown('non-existent-id')).rejects.toThrow(
        ContainerNotFoundException,
      );
    });

    it('should throw ScalingOperationException when replicas is 1', async () => {
      const containerWithMinReplicas = { ...mockContainer, replicas: 1 };
      containerRepository.findOne.mockResolvedValue(containerWithMinReplicas);

      await expect(service.scaleDown('test-container-id')).rejects.toThrow(
        ScalingOperationException,
      );
    });

    it('should throw ScalingOperationException when replicas is 0', async () => {
      const containerWithZeroReplicas = { ...mockContainer, replicas: 0 };
      containerRepository.findOne.mockResolvedValue(containerWithZeroReplicas);

      await expect(service.scaleDown('test-container-id')).rejects.toThrow(
        ScalingOperationException,
      );
    });

    it('should record error metrics when scaling down fails', async () => {
      containerRepository.findOne.mockResolvedValue(mockContainer);
      containerRepository.save.mockRejectedValue(new Error('Database error'));

      try {
        await service.scaleDown('test-container-id');
      } catch (error) {
        // Expected to throw
      }

      expect(metricsService.recordCustomMetric).toHaveBeenCalledWith(
        'scaling_operation_failures',
        1,
      );
      expect(metricsService.recordCustomMetric).toHaveBeenCalledWith(
        'scale_down_failures',
        1,
      );
    });
  });
});
