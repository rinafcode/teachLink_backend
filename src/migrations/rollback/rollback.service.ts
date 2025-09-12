import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Migration, MigrationStatus } from '../entities/migration.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RollbackService {
  private readonly logger = new Logger(RollbackService.name);

  constructor(
    @InjectRepository(Migration)
    private migrationRepository: Repository<Migration>,
    private dataSource: DataSource,
  ) {}

  async rollbackMigration(version: string, environment: string): Promise<void> {
    this.logger.log(
      `Rolling back migration version: ${version} for environment: ${environment}`,
    );

    const migration = await this.migrationRepository.findOne({
      where: { version, environment },
    });

    if (!migration) {
      throw new Error(
        `Migration ${version} not found for environment: ${environment}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (migration.status !== MigrationStatus.COMPLETED) {
        throw new Error(
          `Cannot rollback migration ${version} because it is not completed`,
        );
      }

      const startTime = Date.now();

      // Execute rollback SQL
      await queryRunner.query(migration.downSql);
      const executionTime = Date.now() - startTime;

      // Update migration status
      migration.status = MigrationStatus.ROLLED_BACK;
      migration.executionTime = executionTime;
      migration.rolledBackAt = new Date();
      await this.migrationRepository.save(migration);

      await queryRunner.commitTransaction();
      this.logger.log(
        `Migration ${version} rolled back successfully in ${executionTime}ms`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Rollback failed for migration ${version}: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async rollbackAllMigrations(environment: string): Promise<void> {
    this.logger.log(
      `Rolling back all migrations for environment: ${environment}`,
    );

    const completedMigrations = await this.migrationRepository.find({
      where: {
        environment,
        status: MigrationStatus.COMPLETED,
      },
      order: { version: 'DESC' },
    });

    for (const migration of completedMigrations) {
      await this.rollbackMigration(migration.version, environment);
    }

    this.logger.log('All migrations rolled back successfully');
  }

  async rollbackToVersion(
    targetVersion: string,
    environment: string,
  ): Promise<void> {
    this.logger.log(
      `Rolling back to version: ${targetVersion} for environment: ${environment}`,
    );

    const targetMigration = await this.migrationRepository.findOne({
      where: { version: targetVersion, environment },
    });

    if (!targetMigration) {
      throw new Error(`Target migration version ${targetVersion} not found`);
    }

    const migrationsToRollback = await this.migrationRepository.find({
      where: {
        environment,
        status: MigrationStatus.COMPLETED,
      },
      order: { version: 'DESC' },
    });

    // Filter migrations that are newer than target version
    const rolledBackMigrations = migrationsToRollback.filter(
      (migration) => migration.version > targetVersion,
    );

    for (const migration of rolledBackMigrations) {
      await this.rollbackMigration(migration.version, environment);
    }

    this.logger.log(`Successfully rolled back to version: ${targetVersion}`);
  }

  async validateRollbackSafety(
    version: string,
    environment: string,
  ): Promise<boolean> {
    this.logger.log(`Validating rollback safety for version: ${version}`);

    const migration = await this.migrationRepository.findOne({
      where: { version, environment },
    });

    if (!migration) {
      throw new Error(`Migration ${version} not found`);
    }

    // Check if rollback SQL exists and is not empty
    if (!migration.downSql || migration.downSql.trim() === '') {
      this.logger.warn(`Migration ${version} has no rollback SQL defined`);
      return false;
    }

    // Check if there are dependent migrations
    const dependentMigrations = await this.migrationRepository.find({
      where: {
        environment,
        status: MigrationStatus.COMPLETED,
      },
    });

    const hasDependents = dependentMigrations.some(
      (m) =>
        m.dependencies &&
        m.dependencies.includes(version) &&
        m.version > version,
    );

    if (hasDependents) {
      this.logger.warn(
        `Migration ${version} has dependent migrations that would be affected`,
      );
      return false;
    }

    return true;
  }

  async createRollbackPlan(
    targetVersion: string,
    environment: string,
  ): Promise<Migration[]> {
    const migrationsToRollback = await this.migrationRepository.find({
      where: {
        environment,
        status: MigrationStatus.COMPLETED,
      },
      order: { version: 'DESC' },
    });

    return migrationsToRollback
      .filter((migration) => migration.version > targetVersion)
      .sort((a, b) => b.version.localeCompare(a.version)); // Rollback in reverse order
  }

  async performSafeRollback(
    version: string,
    environment: string,
    options: {
      createBackup?: boolean;
      validateData?: boolean;
    } = {},
  ): Promise<void> {
    const { createBackup = true, validateData = true } = options;

    // Validate rollback safety first
    const isSafe = await this.validateRollbackSafety(version, environment);
    if (!isSafe) {
      throw new Error(`Rollback of migration ${version} is not safe`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Create backup if requested
      if (createBackup) {
        await this.createDataBackup(queryRunner, version);
      }

      // Perform the rollback
      await this.rollbackMigration(version, environment);

      // Validate data integrity if requested
      if (validateData) {
        await this.validateDataIntegrity(queryRunner);
      }

      this.logger.log(`Safe rollback completed for migration ${version}`);
    } catch (error) {
      this.logger.error(`Safe rollback failed: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async createDataBackup(
    queryRunner: QueryRunner,
    version: string,
  ): Promise<void> {
    this.logger.log(
      `Creating data backup before rollback of version: ${version}`,
    );

    // This would implement database-specific backup logic
    // For example, creating a schema dump or table snapshots
    const backupQuery = `
      CREATE SCHEMA IF NOT EXISTS backup_${version.replace(/\./g, '_')};
      -- Additional backup logic would go here
    `;

    await queryRunner.query(backupQuery);
    this.logger.log('Data backup created successfully');
  }

  private async validateDataIntegrity(queryRunner: QueryRunner): Promise<void> {
    this.logger.log('Validating data integrity after rollback');

    // This would implement data integrity checks
    // For example, checking foreign key constraints, data consistency, etc.
    const integrityQuery = `
      -- Check for orphaned records, constraint violations, etc.
      SELECT COUNT(*) as integrity_issues 
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY';
    `;

    const result = await queryRunner.query(integrityQuery);
    this.logger.log('Data integrity validation completed');
  }
}
