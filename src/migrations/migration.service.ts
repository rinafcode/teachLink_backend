import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Migration, MigrationStatus, MigrationType } from './entities/migration.entity';
import { SchemaSnapshot } from './entities/schema-snapshot.entity';
import { SchemaValidationService } from './validation/schema-validation.service';
import { ConflictResolutionService } from './conflicts/conflict-resolution.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface MigrationFile {
  version: string;
  name: string;
  description?: string;
  type: MigrationType;
  upSql: string;
  downSql: string;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @InjectRepository(Migration)
    private migrationRepository: Repository<Migration>,
    @InjectRepository(SchemaSnapshot)
    private snapshotRepository: Repository<SchemaSnapshot>,
    private dataSource: DataSource,
    private configService: ConfigService,
    private schemaValidationService: SchemaValidationService,
    private conflictResolutionService: ConflictResolutionService,
  ) {}

  async runMigrations(environment: string = 'development'): Promise<void> {
    this.logger.log(`Starting migrations for environment: ${environment}`);

    try {
      // Get pending migrations
      const pendingMigrations = await this.getPendingMigrations(environment);
      
      if (pendingMigrations.length === 0) {
        this.logger.log('No pending migrations found');
        return;
      }

      // Check for conflicts
      await this.conflictResolutionService.checkForConflicts(pendingMigrations);

      // Execute migrations in order
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration, environment);
      }

      // Create schema snapshot after successful migrations
      await this.createSchemaSnapshot(environment);

      this.logger.log(`Successfully completed ${pendingMigrations.length} migrations`);
    } catch (error) {
      this.logger.error(`Migration failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async loadMigrationsFromFiles(migrationsPath: string): Promise<Migration[]> {
    this.logger.log(`Loading migrations from: ${migrationsPath}`);
    
    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.migration.json'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsPath, file);
      const migrationData: MigrationFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      const migration = new Migration();
      migration.version = migrationData.version;
      migration.name = migrationData.name;
      migration.description = migrationData.description || '';
      migration.type = migrationData.type;
      migration.filePath = filePath;
      migration.upSql = migrationData.upSql;
      migration.downSql = migrationData.downSql;
      migration.dependencies = migrationData.dependencies || [];
      migration.metadata = migrationData.metadata || {};
      migration.checksum = this.calculateChecksum(migrationData);
      migration.timestamp = new Date();

      migrations.push(migration);
    }

    return migrations;
  }

  async registerMigration(migrationData: MigrationFile, environment: string): Promise<Migration> {
    const existingMigration = await this.migrationRepository.findOne({
      where: { version: migrationData.version, environment }
    });

    if (existingMigration) {
      // Check if migration has changed
      const newChecksum = this.calculateChecksum(migrationData);
      if (existingMigration.checksum !== newChecksum) {
        throw new Error(`Migration ${migrationData.version} has been modified after registration`);
      }
      return existingMigration;
    }

    const migration = new Migration();
    migration.version = migrationData.version;
    migration.name = migrationData.name;
    migration.description = migrationData.description || '';
    migration.type = migrationData.type;
    migration.environment = environment;
    migration.filePath = '';
    migration.upSql = migrationData.upSql;
    migration.downSql = migrationData.downSql;
    migration.dependencies = migrationData.dependencies || [];
    migration.metadata = migrationData.metadata || {};
    migration.checksum = this.calculateChecksum(migrationData);
    migration.timestamp = new Date();

    return await this.migrationRepository.save(migration);
  }

  private async executeMigration(migration: Migration, environment: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`Executing migration: ${migration.version} - ${migration.name}`);

      // Update status to running
      migration.status = MigrationStatus.RUNNING;
      migration.executedBy = this.getCurrentUser();
      migration.executedAt = new Date();
      await this.migrationRepository.save(migration);

      // Validate schema changes
      await this.schemaValidationService.validateMigration(migration);

      // Execute migration SQL
      const startTime = Date.now();
      await queryRunner.query(migration.upSql);
      const executionTime = Date.now() - startTime;

      // Update status to completed
      migration.status = MigrationStatus.COMPLETED;
      migration.executionTime = executionTime;
      await this.migrationRepository.save(migration);

      await queryRunner.commitTransaction();
      this.logger.log(`Migration ${migration.version} completed successfully in ${executionTime}ms`);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      
      // Update status to failed
      migration.status = MigrationStatus.FAILED;
      migration.error = error.message;
      await this.migrationRepository.save(migration);

      this.logger.error(`Migration ${migration.version} failed: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async getPendingMigrations(environment: string): Promise<Migration[]> {
    return await this.migrationRepository.find({
      where: {
        environment,
        status: MigrationStatus.PENDING
      },
      order: { version: 'ASC' }
    });
  }

  async getMigrationHistory(environment: string): Promise<Migration[]> {
    return await this.migrationRepository.find({
      where: { environment },
      order: { executedAt: 'DESC' }
    });
  }

  async getMigrationStatus(version: string, environment: string): Promise<Migration | null> {
    return await this.migrationRepository.findOne({
      where: { version, environment }
    });
  }

  private async createSchemaSnapshot(environment: string): Promise<void> {
    this.logger.log(`Creating schema snapshot for environment: ${environment}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Get current schema information
      const tables = await this.getTableInformation(queryRunner);
      const views = await this.getViewInformation(queryRunner);
      const procedures = await this.getProcedureInformation(queryRunner);
      const functions = await this.getFunctionInformation(queryRunner);

      const schema = {
        tables,
        views,
        procedures,
        functions
      };

      const snapshot = new SchemaSnapshot();
      snapshot.version = await this.getCurrentVersion(environment);
      snapshot.environment = environment;
      snapshot.schema = schema;
      snapshot.tables = tables;
      snapshot.views = views;
      snapshot.procedures = procedures;
      snapshot.functions = functions;
      snapshot.checksum = this.calculateSchemaChecksum(schema);
      snapshot.createdBy = this.getCurrentUser();
      snapshot.timestamp = new Date();

      await this.snapshotRepository.save(snapshot);
      this.logger.log(`Schema snapshot created successfully`);

    } finally {
      await queryRunner.release();
    }
  }

  private async getTableInformation(queryRunner: QueryRunner): Promise<any[]> {
    // This would be database-specific implementation
    // For PostgreSQL example:
    const tablesQuery = `
      SELECT 
        t.table_name,
        json_agg(
          json_build_object(
            'name', c.column_name,
            'type', c.data_type,
            'nullable', c.is_nullable = 'YES',
            'default', c.column_default
          )
        ) as columns
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE t.table_schema = 'public'
      GROUP BY t.table_name
    `;

    return await queryRunner.query(tablesQuery);
  }

  private async getViewInformation(queryRunner: QueryRunner): Promise<any[]> {
    const viewsQuery = `
      SELECT 
        table_name as name,
        view_definition as definition
      FROM information_schema.views
      WHERE table_schema = 'public'
    `;

    return await queryRunner.query(viewsQuery);
  }

  private async getProcedureInformation(queryRunner: QueryRunner): Promise<any[]> {
    const proceduresQuery = `
      SELECT 
        routine_name as name,
        routine_definition as definition
      FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE'
    `;

    return await queryRunner.query(proceduresQuery);
  }

  private async getFunctionInformation(queryRunner: QueryRunner): Promise<any[]> {
    const functionsQuery = `
      SELECT 
        routine_name as name,
        routine_definition as definition
      FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
    `;

    return await queryRunner.query(functionsQuery);
  }

  private async getCurrentVersion(environment: string): Promise<string> {
    const latestMigration = await this.migrationRepository.findOne({
      where: { environment, status: MigrationStatus.COMPLETED },
      order: { version: 'DESC' }
    });

    return latestMigration ? latestMigration.version : '0.0.0';
  }

  private calculateChecksum(data: any): string {
    return crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  private calculateSchemaChecksum(schema: any): string {
    return crypto.createHash('sha256')
      .update(JSON.stringify(schema))
      .digest('hex');
  }

  private getCurrentUser(): string {
    // This would typically come from authentication context
    return process.env.USER || 'system';
  }

  async validateMigrationIntegrity(): Promise<boolean> {
    this.logger.log('Validating migration integrity...');
    
    const allMigrations = await this.migrationRepository.find({
      order: { version: 'ASC' }
    });

    for (const migration of allMigrations) {
      const expectedChecksum = this.calculateChecksum({
        version: migration.version,
        name: migration.name,
        description: migration.description,
        type: migration.type,
        upSql: migration.upSql,
        downSql: migration.downSql,
        dependencies: migration.dependencies,
        metadata: migration.metadata
      });

      if (migration.checksum !== expectedChecksum) {
        this.logger.error(`Migration integrity check failed for version: ${migration.version}`);
        return false;
      }
    }

    this.logger.log('Migration integrity validation passed');
    return true;
  }
}
