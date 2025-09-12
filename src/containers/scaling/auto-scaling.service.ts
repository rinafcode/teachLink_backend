import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Container } from '../entities/container.entity';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  ScalingOperationException,
  ContainerNotFoundException,
  DeploymentFailedException,
} from '../../common/exceptions/custom-exceptions';
import {
  MonitorOperation,
  MonitorDatabase,
} from '../../common/decorators/monitoring.decorator';
import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';
import { DistributedTracingService } from '../../observability/tracing/distributed-tracing.service';

@Injectable()
export class AutoScalingService {
  private readonly logger = new Logger(AutoScalingService.name);

  constructor(
    @InjectRepository(Container)
    private containerRepository: Repository<Container>,
    @InjectQueue('auto-scaling')
    private scalingQueue: Queue,
    private readonly metricsService: MetricsCollectionService,
    private readonly tracingService: DistributedTracingService,
  ) {}

  @MonitorOperation('scale_up', {
    tags: { operation: 'scale_up' },
    recordMetrics: true,
    recordTraces: true,
    recordLogs: true,
  })
  @MonitorDatabase('scale_up', { recordQueryTime: true })
  async scaleUp(containerId: string): Promise<void> {
    const startTime = Date.now();

    try {
      if (!containerId) {
        throw new ScalingOperationException(
          'scaleUp',
          'Container ID is required',
        );
      }

      const container = await this.containerRepository.findOne({
        where: { id: containerId },
      });
      if (!container) {
        throw new ContainerNotFoundException(containerId);
      }

      if (container.replicas >= 10) {
        throw new ScalingOperationException(
          'scaleUp',
          'Maximum replicas limit reached',
        );
      }

      container.replicas += 1;
      await this.containerRepository.save(container);
      await this.scalingQueue.add('scale-up', { containerId });

      // Record success metrics
      const duration = Date.now() - startTime;
      this.metricsService.recordCustomMetric(
        'scaling_operation_duration',
        duration,
      );
      this.metricsService.recordCustomMetric('scale_up_operations', 1);
      this.metricsService.recordCustomMetric(
        'container_replicas',
        container.replicas,
      );

      this.logger.log(
        `Scaled up container: ${container.name} to ${container.replicas} replicas`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record error metrics
      this.metricsService.recordCustomMetric('scaling_operation_failures', 1);
      this.metricsService.recordCustomMetric('scale_up_failures', 1);

      this.logger.error(
        `Failed to scale up container ${containerId}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof ScalingOperationException ||
        error instanceof ContainerNotFoundException
      ) {
        throw error;
      }

      throw new DeploymentFailedException(containerId, error.message);
    }
  }

  @MonitorOperation('scale_down', {
    tags: { operation: 'scale_down' },
    recordMetrics: true,
    recordTraces: true,
    recordLogs: true,
  })
  @MonitorDatabase('scale_down', { recordQueryTime: true })
  async scaleDown(containerId: string): Promise<void> {
    const startTime = Date.now();

    try {
      if (!containerId) {
        throw new ScalingOperationException(
          'scaleDown',
          'Container ID is required',
        );
      }

      const container = await this.containerRepository.findOne({
        where: { id: containerId },
      });
      if (!container) {
        throw new ContainerNotFoundException(containerId);
      }

      if (container.replicas <= 1) {
        throw new ScalingOperationException(
          'scaleDown',
          'Cannot scale down below 1 replica',
        );
      }

      container.replicas -= 1;
      await this.containerRepository.save(container);
      await this.scalingQueue.add('scale-down', { containerId });

      // Record success metrics
      const duration = Date.now() - startTime;
      this.metricsService.recordCustomMetric(
        'scaling_operation_duration',
        duration,
      );
      this.metricsService.recordCustomMetric('scale_down_operations', 1);
      this.metricsService.recordCustomMetric(
        'container_replicas',
        container.replicas,
      );

      this.logger.log(
        `Scaled down container: ${container.name} to ${container.replicas} replicas`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record error metrics
      this.metricsService.recordCustomMetric('scaling_operation_failures', 1);
      this.metricsService.recordCustomMetric('scale_down_failures', 1);

      this.logger.error(
        `Failed to scale down container ${containerId}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof ScalingOperationException ||
        error instanceof ContainerNotFoundException
      ) {
        throw error;
      }

      throw new DeploymentFailedException(containerId, error.message);
    }
  }

  @MonitorOperation('get_scaling_history', {
    tags: { operation: 'get_scaling_history' },
    recordMetrics: true,
    recordTraces: true,
    recordLogs: true,
  })
  async getScalingHistory(containerId: string): Promise<any[]> {
    try {
      if (!containerId) {
        throw new ScalingOperationException(
          'getScalingHistory',
          'Container ID is required',
        );
      }

      const container = await this.containerRepository.findOne({
        where: { id: containerId },
      });
      if (!container) {
        throw new ContainerNotFoundException(containerId);
      }

      // This is a placeholder implementation
      // In a real application, you would query a scaling history table
      const scalingHistory = [
        {
          id: '1',
          containerId,
          operation: 'scale_up',
          previousReplicas: 1,
          newReplicas: 2,
          timestamp: new Date(),
          reason: 'High load detected',
        },
        {
          id: '2',
          containerId,
          operation: 'scale_down',
          previousReplicas: 2,
          newReplicas: 1,
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
          reason: 'Load normalized',
        },
      ];

      this.logger.log(
        `Retrieved scaling history for container: ${container.name}`,
      );
      return scalingHistory;
    } catch (error) {
      this.logger.error(
        `Failed to get scaling history for container ${containerId}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof ScalingOperationException ||
        error instanceof ContainerNotFoundException
      ) {
        throw error;
      }

      throw new DeploymentFailedException(containerId, error.message);
    }
  }
}
