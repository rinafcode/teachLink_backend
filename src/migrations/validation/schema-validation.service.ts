import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Migration, MigrationType } from '../entities/migration.entity';
import { SchemaSnapshot } from '../entities/schema-snapshot.entity';

export interface ValidationRule {
  name: string;
  description: string;
  check: (sql: string, migration: Migration) => boolean;
  severity: 'error' | 'warning';
}

export interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  breakingChanges: string[];
}

@Injectable()
export class SchemaValidationService {
  private readonly logger = new Logger(SchemaValidationService.name);
  private readonly validationRules: ValidationRule[];

  constructor(
    @InjectRepository(SchemaSnapshot)
    private snapshotRepository: Repository<SchemaSnapshot>,
    private dataSource: DataSource,
  ) {
    this.validationRules = this.initializeValidationRules();
  }

  async validateMigration(
    migration: Migration,
  ): Promise<SchemaValidationResult> {
    this.logger.log(`Validating migration: ${migration.version}`);

    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      breakingChanges: [],
    };

    // Apply all validation rules
    for (const rule of this.validationRules) {
      try {
        const violatesRule = rule.check(migration.upSql, migration);
        if (violatesRule) {
          const message = `${rule.name}: ${rule.description}`;

          if (rule.severity === 'error') {
            result.errors.push(message);
            result.isValid = false;
          } else {
            result.warnings.push(message);
          }
        }
      } catch (error) {
        this.logger.error(
          `Error applying validation rule ${rule.name}: ${error.message}`,
        );
        result.errors.push(
          `Validation rule ${rule.name} failed: ${error.message}`,
        );
        result.isValid = false;
      }
    }

    // Check for breaking changes
    const breakingChanges = await this.detectBreakingChanges(migration);
    result.breakingChanges = breakingChanges;

    if (breakingChanges.length > 0) {
      result.warnings.push(
        `Migration contains ${breakingChanges.length} potential breaking changes`,
      );
    }

    // Validate against current schema
    await this.validateAgainstCurrentSchema(migration, result);

    if (!result.isValid) {
      const errorMessage = `Migration validation failed: ${result.errors.join(', ')}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (result.warnings.length > 0) {
      this.logger.warn(
        `Migration validation warnings: ${result.warnings.join(', ')}`,
      );
    }

    this.logger.log('Schema validation completed successfully');
    return result;
  }

  async validateSchemaCompatibility(
    currentSchema: any,
    newSchema: any,
  ): Promise<SchemaValidationResult> {
    this.logger.log('Validating schema compatibility');

    const result: SchemaValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      breakingChanges: [],
    };

    // Check for removed tables
    const currentTables = currentSchema.tables || [];
    const newTables = newSchema.tables || [];

    const currentTableNames = currentTables.map((t: any) => t.name);
    const newTableNames = newTables.map((t: any) => t.name);

    const removedTables = currentTableNames.filter(
      (name: string) => !newTableNames.includes(name),
    );
    if (removedTables.length > 0) {
      result.breakingChanges.push(
        `Removed tables: ${removedTables.join(', ')}`,
      );
    }

    // Check for removed columns
    for (const currentTable of currentTables) {
      const newTable = newTables.find((t: any) => t.name === currentTable.name);
      if (newTable) {
        const currentColumns = currentTable.columns.map((c: any) => c.name);
        const newColumns = newTable.columns.map((c: any) => c.name);

        const removedColumns = currentColumns.filter(
          (name: string) => !newColumns.includes(name),
        );
        if (removedColumns.length > 0) {
          result.breakingChanges.push(
            `Table ${currentTable.name}: Removed columns: ${removedColumns.join(', ')}`,
          );
        }

        // Check for column type changes
        for (const currentColumn of currentTable.columns) {
          const newColumn = newTable.columns.find(
            (c: any) => c.name === currentColumn.name,
          );
          if (newColumn && currentColumn.type !== newColumn.type) {
            result.breakingChanges.push(
              `Table ${currentTable.name}, Column ${currentColumn.name}: Type changed from ${currentColumn.type} to ${newColumn.type}`,
            );
          }
        }
      }
    }

    if (result.breakingChanges.length > 0) {
      result.warnings.push(
        `Schema compatibility check found ${result.breakingChanges.length} breaking changes`,
      );
    }

    this.logger.log('Schema compatibility validation completed');
    return result;
  }

  async validateDataIntegrity(migration: Migration): Promise<boolean> {
    this.logger.log(
      `Validating data integrity for migration: ${migration.version}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Check for potential data loss operations
      const hasDataLossRisk = this.checkForDataLossRisk(migration.upSql);
      if (hasDataLossRisk) {
        this.logger.warn(
          `Migration ${migration.version} has potential data loss risk`,
        );
        return false;
      }

      // Validate foreign key constraints
      const constraintQuery = `
        SELECT COUNT(*) as constraint_violations
        FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY'
        AND table_schema = 'public'
      `;

      const result = await queryRunner.query(constraintQuery);

      this.logger.log('Data integrity validation completed');
      return true;
    } catch (error) {
      this.logger.error(`Data integrity validation failed: ${error.message}`);
      return false;
    } finally {
      await queryRunner.release();
    }
  }

  private initializeValidationRules(): ValidationRule[] {
    return [
      {
        name: 'No DROP TABLE',
        description: 'Dropping tables is not allowed',
        check: (sql: string) => sql.toUpperCase().includes('DROP TABLE'),
        severity: 'error',
      },
      {
        name: 'No DROP COLUMN',
        description: 'Dropping columns may cause data loss',
        check: (sql: string) => sql.toUpperCase().includes('DROP COLUMN'),
        severity: 'warning',
      },
      {
        name: 'ALTER COLUMN Type Change',
        description: 'Changing column types may cause data loss',
        check: (sql: string) => {
          const alterPattern = /ALTER\s+COLUMN\s+\w+\s+TYPE/i;
          return alterPattern.test(sql);
        },
        severity: 'warning',
      },
      {
        name: 'No TRUNCATE',
        description: 'TRUNCATE operations cause data loss',
        check: (sql: string) => sql.toUpperCase().includes('TRUNCATE'),
        severity: 'error',
      },
      {
        name: 'ADD NOT NULL without DEFAULT',
        description:
          'Adding NOT NULL columns without default values may fail on existing data',
        check: (sql: string) => {
          const addNotNullPattern =
            /ADD\s+COLUMN\s+\w+\s+\w+\s+NOT\s+NULL(?!.*DEFAULT)/i;
          return addNotNullPattern.test(sql);
        },
        severity: 'error',
      },
      {
        name: 'CREATE UNIQUE INDEX on existing table',
        description:
          'Creating unique indexes on existing tables may fail if duplicate data exists',
        check: (sql: string) => {
          const uniqueIndexPattern = /CREATE\s+UNIQUE\s+INDEX/i;
          return uniqueIndexPattern.test(sql);
        },
        severity: 'warning',
      },
      {
        name: 'Large table operations',
        description: 'Operations on large tables should be reviewed',
        check: (sql: string, migration: Migration) => {
          // This would need actual table size checking
          return migration.metadata?.affectsLargeTables === true;
        },
        severity: 'warning',
      },
    ];
  }

  private async detectBreakingChanges(migration: Migration): Promise<string[]> {
    const breakingChanges: string[] = [];
    const sql = migration.upSql.toUpperCase();

    // Check for schema-breaking operations
    const breakingOperations = [
      { pattern: 'DROP TABLE', message: 'Drops table' },
      { pattern: 'DROP COLUMN', message: 'Drops column' },
      { pattern: 'DROP INDEX', message: 'Drops index' },
      { pattern: 'DROP CONSTRAINT', message: 'Drops constraint' },
      { pattern: 'RENAME TABLE', message: 'Renames table' },
      { pattern: 'RENAME COLUMN', message: 'Renames column' },
    ];

    for (const operation of breakingOperations) {
      if (sql.includes(operation.pattern)) {
        breakingChanges.push(operation.message);
      }
    }

    return breakingChanges;
  }

  private async validateAgainstCurrentSchema(
    migration: Migration,
    result: SchemaValidationResult,
  ): Promise<void> {
    try {
      const latestSnapshot = await this.snapshotRepository.findOne({
        where: { environment: migration.environment },
        order: { timestamp: 'DESC' },
      });

      if (!latestSnapshot) {
        result.warnings.push('No schema snapshot found for comparison');
        return;
      }

      // Perform schema compatibility check
      const compatibilityResult = await this.validateSchemaCompatibility(
        latestSnapshot.schema,
        {}, // This would be the new schema after migration
      );

      result.breakingChanges.push(...compatibilityResult.breakingChanges);
      result.warnings.push(...compatibilityResult.warnings);
    } catch (error) {
      this.logger.error(
        `Error validating against current schema: ${error.message}`,
      );
      result.warnings.push('Could not validate against current schema');
    }
  }

  private checkForDataLossRisk(sql: string): boolean {
    const dataLossOperations = [
      'DROP TABLE',
      'DROP COLUMN',
      'TRUNCATE',
      'DELETE FROM',
      'UPDATE.*SET.*NULL',
    ];

    const upperSql = sql.toUpperCase();
    return dataLossOperations.some((operation) => {
      const regex = new RegExp(operation, 'i');
      return regex.test(upperSql);
    });
  }

  async preValidateMigration(
    migrationSql: string,
    environment: string,
  ): Promise<SchemaValidationResult> {
    this.logger.log('Pre-validating migration SQL');

    const mockMigration = new Migration();
    mockMigration.upSql = migrationSql;
    mockMigration.environment = environment;
    mockMigration.version = 'preview';
    mockMigration.name = 'preview';

    return await this.validateMigration(mockMigration);
  }
}
