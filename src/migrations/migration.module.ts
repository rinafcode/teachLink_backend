import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MigrationService } from './migration.service';
import { RollbackService } from './rollback/rollback.service';
import { SchemaValidationService } from './validation/schema-validation.service';
import { EnvironmentSyncService } from './environments/environment-sync.service';
import { ConflictResolutionService } from './conflicts/conflict-resolution.service';
import { Migration } from './entities/migration.entity';
import { SchemaSnapshot } from './entities/schema-snapshot.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Migration, SchemaSnapshot]),
  ],
  providers: [
    MigrationService,
    RollbackService,
    SchemaValidationService,
    EnvironmentSyncService,
    ConflictResolutionService,
  ],
  exports: [
    MigrationService,
    RollbackService,
    SchemaValidationService,
    EnvironmentSyncService,
    ConflictResolutionService,
  ],
})
export class MigrationModule {}
