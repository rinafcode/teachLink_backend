import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, Raw, DataSource } from 'typeorm';
import { Migration, MigrationStatus } from '../entities/migration.entity';
import { IMigrationConfig } from '../migration.service';
import { MIGRATION_REGISTRY } from '../migration.registry';

/**
 * Provides rollback operations.
 */
@Injectable()
export class RollbackService {
  private readonly logger = new Logger(RollbackService.name);

  constructor(
    @InjectRepository(Migration)
    private migrationRepository: Repository<Migration>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  /**
   * Rolls back a specific migration
   */
  async rollbackMigration(migration: IMigrationConfig): Promise<void> {
    this.logger.log(`Rolling back migration: ${migration.name}`);

    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        await migration.down(queryRunner);
        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }

      // Update migration record
      const existingMigration = await this.migrationRepository.findOne({
        where: { name: migration.name },
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
      take: count,
    });

    // Get all registered migrations to find the down functions
    const registeredMigrations = this.getRegisteredMigrations();

    for (const appliedMigration of lastAppliedMigrations) {
      const migrationConfig = registeredMigrations.find((m) => m.name === appliedMigration.name);

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
      order: { appliedAt: 'DESC' },
    });

    // Get all registered migrations to find the down functions
    const registeredMigrations = this.getRegisteredMigrations();

    for (const appliedMigration of allAppliedMigrations) {
      const migrationConfig = registeredMigrations.find((m) => m.name === appliedMigration.name);

      if (migrationConfig) {
        await this.rollbackMigration(migrationConfig);
      } else {
        this.logger.warn(`Could not find migration config for: ${appliedMigration.name}`);
      }
    }
  }

  /**
   * Gets all registered migrations
   */
  private getRegisteredMigrations(): IMigrationConfig[] {
    return MIGRATION_REGISTRY;
  }

  /**
   * Rolls back all migrations down to (but not including) the target version.
   * Migrations are rolled back in reverse-applied order.
   */
  async rollbackToVersion(targetMigrationName: string): Promise<void> {
    this.logger.log(`Rolling back to version: ${targetMigrationName}`);

    const registeredMigrations = this.getRegisteredMigrations();

    // Verify the target migration exists in the registry
    const targetExists = registeredMigrations.some((m) => m.name === targetMigrationName);
    if (!targetExists) {
      throw new Error(`Target migration not found in registry: ${targetMigrationName}`);
    }

    // Get all applied migrations that were applied AFTER the target, in reverse order
    const targetRecord = await this.migrationRepository.findOne({
      where: { name: targetMigrationName },
    });

    const whereClause = targetRecord?.appliedAt
      ? {
          status: MigrationStatus.COMPLETED,
          appliedAt: Raw((alias) => `${alias} > :appliedAt`, { appliedAt: targetRecord.appliedAt }),
        }
      : { status: MigrationStatus.COMPLETED };

    const migrationsToRollback = await this.migrationRepository.find({
      where: whereClause,
      order: { appliedAt: 'DESC' },
    });

    for (const appliedMigration of migrationsToRollback) {
      const migrationConfig = registeredMigrations.find((m) => m.name === appliedMigration.name);
      if (migrationConfig) {
        await this.rollbackMigration(migrationConfig);
      } else {
        this.logger.warn(`Could not find migration config for: ${appliedMigration.name}`);
      }
    }

    this.logger.log(`Rollback to version ${targetMigrationName} complete.`);
  }

  /**
   * Rolls back a specific named migration regardless of order.
   */
  async rollbackByName(migrationName: string): Promise<void> {
    this.logger.log(`Rolling back specific migration by name: ${migrationName}`);

    const registeredMigrations = this.getRegisteredMigrations();
    const migrationConfig = registeredMigrations.find((m) => m.name === migrationName);

    if (!migrationConfig) {
      throw new Error(`Migration not found in registry: ${migrationName}`);
    }

    const canRollback = await this.canRollbackMigration(migrationName);
    if (!canRollback) {
      throw new Error(
        `Cannot roll back migration ${migrationName}: it either hasn't been applied or has dependent migrations applied after it.`,
      );
    }

    await this.rollbackMigration(migrationConfig);
  }
  /**
   * Executes can Rollback Migration.
   * @param migrationName The migration name.
   * @returns Whether the operation succeeded.
   */
  async canRollbackMigration(migrationName: string): Promise<boolean> {
    // Check if the migration exists and is completed
    const migration = await this.migrationRepository.findOne({
      where: { name: migrationName, status: MigrationStatus.COMPLETED },
    });

    if (!migration) {
      return false;
    }

    // Check if there are dependent migrations that have been applied after this one
    const laterMigrations = await this.migrationRepository.find({
      where: {
        appliedAt: Raw((alias) => `${alias} > :appliedAt`, { appliedAt: migration.appliedAt }),
      },
    });

    // In a real implementation, you'd check dependencies here
    // For now, we'll return true if no later migrations exist
    return laterMigrations.length === 0;
  }
}
