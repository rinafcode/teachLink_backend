import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Container } from '../entities/container.entity';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class AutoScalingService {
  private readonly logger = new Logger(AutoScalingService.name);

  constructor(
    @InjectRepository(Container)
    private containerRepository: Repository<Container>,
    @InjectQueue('auto-scaling')
    private scalingQueue: Queue,
  ) {}

  async scaleUp(containerId: string): Promise<void> {
    try {
      const container = await this.containerRepository.findOne(containerId);
      if (container) {
        container.replicas += 1;
        await this.containerRepository.save(container);
        await this.scalingQueue.add('scale-up', { containerId });
        this.logger.log(`Scaled up container: ${container.name}`);
      }
    } catch (error) {
      this.logger.error(`Failed to scale up container: ${error.message}`);
      throw new Error(`Failed to scale up container: ${error.message}`);
    }
  }

  async scaleDown(containerId: string): Promise<void> {
    try {
      const container = await this.containerRepository.findOne(containerId);
      if (container && container.replicas > 1) {
        container.replicas -= 1;
        await this.containerRepository.save(container);
        await this.scalingQueue.add('scale-down', { containerId });
        this.logger.log(`Scaled down container: ${container.name}`);
      }
    } catch (error) {
      this.logger.error(`Failed to scale down container: ${error.message}`);
      throw new Error(`Failed to scale down container: ${error.message}`);
    }
  }
}

