import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Migration, MigrationStatus } from './entities/migration.entity';
import { ConflictResolutionService } from './conflicts/conflict-resolution.service';
import { SchemaValidationService } from './validation/schema-validation.service';
import { RollbackService } from './rollback/rollback.service';
import { EnvironmentSyncService } from './environments/environment-sync.service';

export interface MigrationConfig {
  name: string;
  up: (connection: any) => Promise<void>;
  down: (connection: any) => Promise<void>;
  version: string;
  dependencies?: string[];
}

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);
  
  constructor(
    @InjectRepository(Migration)
    private migrationRepository: Repository<Migration>,
    private conflictResolutionService: ConflictResolutionService,
    private schemaValidationService: SchemaValidationService,
    private rollbackService: RollbackService,
    private environmentSyncService: EnvironmentSyncService,
  ) {}

  /**
   * Executes pending migrations
   */
  async runPendingMigrations(): Promise<void> {
    this.logger.log('Starting pending migrations...');
    
    // Get all applied migrations
    const appliedMigrations = await this.migrationRepository.find({
      order: { createdAt: 'ASC' },
    });
    
    // Get all registered migrations
    const registeredMigrations = this.getRegisteredMigrations();
    
    // Filter for unapplied migrations
    const pendingMigrations = registeredMigrations.filter(registered => {
      return !appliedMigrations.some(applied => applied.name === registered.name);
    });
    
    // Validate dependencies
    for (const migration of pendingMigrations) {
      if (!this.validateDependencies(migration, appliedMigrations)) {
        throw new Error(`Dependency not met for migration: ${migration.name}`);
      }
    }
    
    // Execute pending migrations
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }
    
    this.logger.log('All pending migrations completed.');
  }

  /**
   * Executes a single migration
   */
  private async executeMigration(migration: MigrationConfig): Promise<void> {
    this.logger.log(`Executing migration: ${migration.name}`);
    
    try {
      // Check for conflicts
      const hasConflict = await this.conflictResolutionService.checkForConflicts(migration);
      if (hasConflict) {
        await this.conflictResolutionService.resolveConflict(migration);
      }
      
      // Validate schema before applying migration
      await this.schemaValidationService.validateBeforeMigration(migration);
      
      // Execute the migration
      const connection = await this.getConnection();
      await migration.up(connection);
      
      // Record migration in the database
      const migrationRecord = new Migration();
      migrationRecord.name = migration.name;
      migrationRecord.version = migration.version;
      migrationRecord.status = MigrationStatus.COMPLETED;
      migrationRecord.appliedAt = new Date();
      
      await this.migrationRepository.save(migrationRecord);
      
      // Sync environment after successful migration
      await this.environmentSyncService.syncAfterMigration(migration);
      
      this.logger.log(`Successfully executed migration: ${migration.name}`);
    } catch (error) {
      this.logger.error(`Failed to execute migration: ${migration.name}`, error.stack);
      
      // Attempt rollback on failure
      await this.rollbackService.rollbackMigration(migration);
      
      throw error;
    }
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
   * Validates migration dependencies
   */
  private validateDependencies(migration: MigrationConfig, appliedMigrations: Migration[]): boolean {
    if (!migration.dependencies || migration.dependencies.length === 0) {
      return true;
    }
    
    return migration.dependencies.every(depName => {
      return appliedMigrations.some(m => m.name === depName);
    });
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
   * Lists all migrations with their status
   */
  async listMigrations(): Promise<Array<{ name: string; version: string; status: string; appliedAt?: Date }>> {
    const appliedMigrations = await this.migrationRepository.find({
      order: { createdAt: 'ASC' },
    });
    
    const registeredMigrations = this.getRegisteredMigrations();
    
    // Combine applied and registered migrations
    const allMigrations = [...appliedMigrations.map(m => ({
      name: m.name,
      version: m.version,
      status: m.status,
      appliedAt: m.appliedAt
    }))];
    
    // Add unapplied migrations
    registeredMigrations.forEach(registered => {
      const exists = appliedMigrations.some(m => m.name === registered.name);
      if (!exists) {
        allMigrations.push({
          name: registered.name,
          version: registered.version,
          status: MigrationStatus.PENDING,
          appliedAt: undefined,
        });
      }
    });
    
    return allMigrations;
  }

  /**
   * Resets all migrations (for development purposes)
   */
  async resetMigrations(): Promise<void> {
    this.logger.log('Resetting all migrations...');
    
    const appliedMigrations = await this.migrationRepository.find({
      order: { createdAt: 'DESC' },
    });
    
    for (const migration of appliedMigrations) {
      // Find the actual migration config to get the 'down' function
      const registeredMigration = this.getRegisteredMigrations().find(m => m.name === migration.name);
      
      if (registeredMigration) {
        await this.rollbackService.rollbackMigration(registeredMigration);
      }
      
      // Remove from migration history
      await this.migrationRepository.remove(migration);
    }
    
    this.logger.log('All migrations have been reset.');
  }
}