import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { Migration, MigrationStatus } from '../entities/migration.entity';
import { MigrationConfig } from '../migration.service';

@Injectable()
export class RollbackService {
  private readonly logger = new Logger(RollbackService.name);

  constructor(
    @InjectRepository(Migration)
    private migrationRepository: Repository<Migration>,
  ) {}

  /**
   * Rolls back a specific migration
   */
  async rollbackMigration(migration: MigrationConfig): Promise<void> {
    this.logger.log(`Rolling back migration: ${migration.name}`);

    try {
      // Get database connection
      const connection = await this.getConnection();

      // Execute the down migration
      await migration.down(connection);

      // Update migration record
      const existingMigration = await this.migrationRepository.findOne({
        where: { name: migration.name }
      });

      if (existingMigration) {
        existingMigration.status = MigrationStatus.ROLLED_BACK;
        existingMigration.rolledBackAt = new Date();
        await this.migrationRepository.save(existingMigration);
      }

      this.logger.log(`Successfully rolled back migration: ${migration.name}`);
    } catch (error) {
      this.logger.error(`Failed to roll back migration: ${migration.name}`, error.stack);
      throw error;
    }
  }

  /**
   * Rolls back the last N migrations
   */
  async rollbackLastMigrations(count: number = 1): Promise<void> {
    this.logger.log(`Rolling back last ${count} migrations`);

    // Get the last N applied migrations
    const lastAppliedMigrations = await this.migrationRepository.find({
      where: { status: MigrationStatus.COMPLETED },
      order: { appliedAt: 'DESC' },
      take: count
    });

    // Get all registered migrations to find the down functions
    const registeredMigrations = this.getRegisteredMigrations();

    for (const appliedMigration of lastAppliedMigrations) {
      const migrationConfig = registeredMigrations.find(m => m.name === appliedMigration.name);
      
      if (migrationConfig) {
        await this.rollbackMigration(migrationConfig);
      } else {
        this.logger.warn(`Could not find migration config for: ${appliedMigration.name}`);
      }
    }
  }

  /**
   * Rolls back all migrations
   */
  async rollbackAllMigrations(): Promise<void> {
    this.logger.log('Rolling back all migrations');

    // Get all applied migrations in reverse order
    const allAppliedMigrations = await this.migrationRepository.find({
      where: { status: MigrationStatus.COMPLETED },
      order: { appliedAt: 'DESC' }
    });

    // Get all registered migrations to find the down functions
    const registeredMigrations = this.getRegisteredMigrations();

    for (const appliedMigration of allAppliedMigrations) {
      const migrationConfig = registeredMigrations.find(m => m.name === appliedMigration.name);
      
      if (migrationConfig) {
        await this.rollbackMigration(migrationConfig);
      } else {
        this.logger.warn(`Could not find migration config for: ${appliedMigration.name}`);
      }
    }
  }

  /**
   * Gets database connection
   */
  private async getConnection(): Promise<any> {
    // In a real implementation, this would return the actual database connection
    // For now, returning a mock connection
    return {};
  }

  /**
   * Gets all registered migrations
   */
  private getRegisteredMigrations(): MigrationConfig[] {
    // In a real implementation, this would load migrations from files or configuration
    // For now, returning an empty array - this would be populated based on your actual migrations
    return [];
  }

  /**
   * Checks if a migration can be safely rolled back
   */
  async canRollbackMigration(migrationName: string): Promise<boolean> {
    // Check if the migration exists and is completed
    const migration = await this.migrationRepository.findOne({
      where: { name: migrationName, status: MigrationStatus.COMPLETED }
    });

    if (!migration) {
      return false;
    }

    // Check if there are dependent migrations that have been applied after this one
    const laterMigrations = await this.migrationRepository.find({
      where: {
        appliedAt: Raw(alias => `${alias} > :appliedAt`, { appliedAt: migration.appliedAt }),
      },
    });

    // In a real implementation, you'd check dependencies here
    // For now, we'll return true if no later migrations exist
    return laterMigrations.length === 0;
  }
}