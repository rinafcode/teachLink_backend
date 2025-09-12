import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Container } from '../entities/container.entity';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class LoadBalancingService {
  private readonly logger = new Logger(LoadBalancingService.name);

  constructor(
    @InjectRepository(Container)
    private containerRepository: Repository<Container>,
    @InjectQueue('load-balancing')
    private balancingQueue: Queue,
  ) {}

  async balanceTraffic(containerIds: string[]): Promise<void> {
    try {
      const containers = await this.containerRepository.findByIds(containerIds);
      // Example logic for balancing traffic among containers
      containers.forEach((container) => {
        // Add logic here for balancing
      });
      await this.balancingQueue.add('balance-traffic', { containerIds });
      this.logger.log(
        `Traffic balanced among containers: ${containerIds.join(', ')}`,
      );
    } catch (error) {
      this.logger.error(`Failed to balance traffic: ${error.message}`);
      throw new Error(`Failed to balance traffic: ${error.message}`);
    }
  }
}
