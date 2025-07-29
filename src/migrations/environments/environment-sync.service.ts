import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchemaSnapshot } from '../entities/schema-snapshot.entity';

@Injectable()
export class EnvironmentSyncService {
  private readonly logger = new Logger(EnvironmentSyncService.name);

  constructor(
    @InjectRepository(SchemaSnapshot)
    private snapshotRepository: Repository<SchemaSnapshot>,
  ) {}

  async synchronizeSchema(sourceEnvironment: string, targetEnvironment: string): Promise<void> {
    this.logger.log(`Synchronizing schema from ${sourceEnvironment} to ${targetEnvironment}`);
    try {
      const sourceSnapshot = await this.snapshotRepository.findOne({
        where: { environment: sourceEnvironment },
        order: { timestamp: 'DESC' }
      });

      if (!sourceSnapshot) {
        throw new Error(`No schema snapshot found for source environment: ${sourceEnvironment}`);
      }

      const targetSnapshot = await this.snapshotRepository.findOne({
        where: { environment: targetEnvironment },
        order: { timestamp: 'DESC' }
      });

      if (!targetSnapshot || sourceSnapshot.checksum !== targetSnapshot.checksum) {
        this.logger.warn(`Schemas are not synchronized: Initiating synchronization process`);
        await this.applySchemaChanges(sourceSnapshot, targetEnvironment);
      } else {
        this.logger.log('Schemas are already synchronized');
      }
    } catch (error) {
      this.logger.error(`Failed to synchronize schema: ${error.message}`);
      throw error;
    }
  }

  private async applySchemaChanges(sourceSnapshot: SchemaSnapshot, targetEnvironment: string): Promise<void> {
    this.logger.log(`Applying schema changes to ${targetEnvironment}`);
    
    // This is where the logic to update the target environment to match the source snapshot would go.
    // This will require generating and executing the necessary SQL changes
    
    // For example purposes, log the schema change intent
    this.logger.log(`Copying schema definition from ${sourceSnapshot.version} in environment ${sourceSnapshot.environment}`);
  }

  async validateSynchronization(sourceEnvironment: string, targetEnvironment: string): Promise<boolean> {
    this.logger.log(`Validating schema synchronization from ${sourceEnvironment} to ${targetEnvironment}`);

    const sourceSnapshot = await this.snapshotRepository.findOne({
      where: { environment: sourceEnvironment },
      order: { timestamp: 'DESC' }
    });

    const targetSnapshot = await this.snapshotRepository.findOne({
      where: { environment: targetEnvironment },
      order: { timestamp: 'DESC' }
    });

    if (!sourceSnapshot || !targetSnapshot) {
      this.logger.warn('Synchronization validation failed: Missing snapshots');
      return false;
    }

    if (sourceSnapshot.checksum !== targetSnapshot.checksum) {
      this.logger.warn(`Schemas are not synchronized: Checksums differ`);
      return false;
    }

    this.logger.log('Schemas are synchronized');
    return true;
  }
}
