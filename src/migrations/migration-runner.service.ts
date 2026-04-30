import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { MigrationService } from './migration.service';

/**
 * Provides migration Runner operations.
 */
@Injectable()
export class MigrationRunnerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationRunnerService.name);

  constructor(private migrationService: MigrationService) {}

  /**
   * Executes on Application Bootstrap.
   * @returns The operation result.
   */
  async onApplicationBootstrap() {
    // Optionally run migrations automatically when the application starts
    // This can be controlled via configuration
    if (process.env.AUTO_RUN_MIGRATIONS === 'true') {
      await this.runMigrations();
    }
  }

  /**
   * Runs all pending migrations
   */
  async runMigrations(): Promise<void> {
    this.logger.log('Starting migration process...');
    try {
      await this.migrationService.runPendingMigrations();
      this.logger.log('Migration process completed successfully');
    } catch (error) {
      this.logger.error('Migration process failed', error.stack);
      throw error;
    }
  }

  /**
   * Gets the status of all migrations
   */
  async getMigrationStatus(): Promise<any> {
    return await this.migrationService.listMigrations();
  }
}
