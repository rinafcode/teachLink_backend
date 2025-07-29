import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Container } from '../entities/container.entity';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class ContainerMonitoringService {
  private readonly logger = new Logger(ContainerMonitoringService.name);

  constructor(
    @InjectRepository(Container)
    private containerRepository: Repository<Container>,
    @InjectQueue('container-monitoring')
    private monitoringQueue: Queue,
  ) {}

  async checkContainerHealth(containerId: string): Promise<void> {
    try {
      const container = await this.containerRepository.findOne(containerId);
      if (container) {
        // Logic to check container health
        const isHealthy = true;  // Placeholder for actual health check
        if (!isHealthy) {
          this.logger.warn(`Container ${container.name} is not healthy`);
        }
        await this.monitoringQueue.add('health-check', { containerId, isHealthy });
        this.logger.log(`Checked health for container: ${container.name}`);
      }
    } catch (error) {
      this.logger.error(`Failed to check container health: ${error.message}`);
      throw new Error(`Failed to check container health: ${error.message}`);
    }
  }
}

