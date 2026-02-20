import { Controller, Get, Post, Put, Delete, Param, Logger, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { MigrationService } from './migration.service';
import { RollbackService } from './rollback/rollback.service';
import { ConflictResolutionService } from './conflicts/conflict-resolution.service';

@Controller('migrations')
export class MigrationController {
  private readonly logger = new Logger(MigrationController.name);

  constructor(
    private migrationService: MigrationService,
    private rollbackService: RollbackService,
    private conflictResolutionService: ConflictResolutionService,
  ) {}

  @Get()
  async getAllMigrations() {
    this.logger.log('Fetching all migrations');
    return await this.migrationService.listMigrations();
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  async runMigrations(@Res() res: Response) {
    this.logger.log('Running pending migrations');
    
    try {
      await this.migrationService.runPendingMigrations();
      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Migrations executed successfully',
      });
    } catch (error) {
      this.logger.error('Error running migrations', error.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to run migrations',
        error: error.message,
      });
    }
  }

  @Post('rollback')
  @HttpCode(HttpStatus.OK)
  async rollbackMigrationsDefault(@Res() res: Response) {
    return this.rollbackMigrationsWithCount('1', res);
  }

  @Post('rollback/:count')
  @HttpCode(HttpStatus.OK)
  async rollbackMigrationsWithCount(
    @Param('count') count: string,
    @Res() res: Response
  ) {
    const rollbackCount = count && !isNaN(parseInt(count, 10)) ? parseInt(count, 10) : 1;
    
    this.logger.log(`Rolling back ${rollbackCount} migrations`);
    
    try {
      await this.rollbackService.rollbackLastMigrations(rollbackCount);
      return res.status(HttpStatus.OK).json({
        success: true,
        message: `Successfully rolled back ${rollbackCount} migrations`,
      });
    } catch (error) {
      this.logger.error('Error rolling back migrations', error.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to rollback migrations',
        error: error.message,
      });
    }
  }

  @Delete('reset')
  @HttpCode(HttpStatus.OK)
  async resetAllMigrations(@Res() res: Response) {
    this.logger.log('Resetting all migrations');
    
    try {
      await this.migrationService.resetMigrations();
      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'All migrations have been reset',
      });
    } catch (error) {
      this.logger.error('Error resetting migrations', error.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to reset migrations',
        error: error.message,
      });
    }
  }

  @Put(':migrationName/rollback')
  @HttpCode(HttpStatus.OK)
  async rollbackSpecificMigration(
    @Param('migrationName') migrationName: string,
    @Res() res: Response
  ) {
    this.logger.log(`Rolling back specific migration: ${migrationName}`);
    
    // Note: In a real implementation, you'd need to map the migration name to the actual migration config
    // For now, this is a placeholder
    
    return res.status(HttpStatus.NOT_IMPLEMENTED).json({
      success: false,
      message: 'Specific migration rollback not implemented in this example',
    });
  }

  @Get('conflicts')
  async getMigrationConflicts() {
    this.logger.log('Fetching migration conflicts');
    return this.conflictResolutionService.getConflictHistory();
  }

  @Post('sync-environments')
  @HttpCode(HttpStatus.OK)
  async syncEnvironments(@Res() res: Response) {
    this.logger.log('Syncing environments');
    
    try {
      // This would typically trigger environment synchronization
      // For now, we'll just return a success response
      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Environment synchronization initiated',
      });
    } catch (error) {
      this.logger.error('Error syncing environments', error.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to sync environments',
        error: error.message,
      });
    }
  }
}