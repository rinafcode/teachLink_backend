import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Container } from '../entities/container.entity';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class DeploymentService {
  private readonly logger = new Logger(DeploymentService.name);

  constructor(
    @InjectRepository(Container)
    private containerRepository: Repository<Container>,
    @InjectQueue('deployment-management')
    private deploymentQueue: Queue,
  ) {}

  async deployNewVersion(containerId: string, newImageTag: string): Promise<void> {
    try {
      const container = await this.containerRepository.findOne(containerId);
      if (container) {
        container.imageTag = newImageTag;
        await this.containerRepository.save(container);
        await this.deploymentQueue.add('deploy-version', { containerId, newImageTag });
        this.logger.log(`Deployed new version for container: ${container.name}`);
      }
    } catch (error) {
      this.logger.error(`Failed to deploy new version: ${error.message}`);
      throw new Error(`Failed to deploy new version: ${error.message}`);
    }
  }
}

