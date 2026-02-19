import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Migration } from './entities/migration.entity';
import { MigrationService } from './migration.service';
import { RollbackService } from './rollback/rollback.service';
import { SchemaValidationService } from './validation/schema-validation.service';
import { EnvironmentSyncService } from './environments/environment-sync.service';
import { ConflictResolutionService } from './conflicts/conflict-resolution.service';
import { MigrationController } from './migration.controller';
import { MigrationRunnerService } from './migration-runner.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Migration]),
  ],
  controllers: [
    MigrationController,
  ],
  providers: [
    MigrationService,
    RollbackService,
    SchemaValidationService,
    EnvironmentSyncService,
    ConflictResolutionService,
    MigrationRunnerService,
  ],
  exports: [
    MigrationService,
    RollbackService,
    SchemaValidationService,
    EnvironmentSyncService,
    ConflictResolutionService,
    MigrationRunnerService,
  ],
})
export class MigrationModule {}