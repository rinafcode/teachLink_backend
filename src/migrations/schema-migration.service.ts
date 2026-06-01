import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface MigrationRecord {
  version: number;
  name: string;
  appliedAt: Date;
}

@Injectable()
export class SchemaMigrationService {
  private readonly logger = new Logger(SchemaMigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  /** Returns all applied migrations ordered by version. */
  async getApplied(): Promise<MigrationRecord[]> {
    const result = await this.dataSource.query<MigrationRecord[]>(
      `SELECT version, name, applied_at AS "appliedAt"
       FROM schema_migrations
       ORDER BY version ASC`,
    );
    return result;
  }

  /** Runs pending migrations inside a transaction for zero-downtime apply. */
  async runPending(migrations: Array<{ version: number; name: string; sql: string }>): Promise<void> {
    const applied = await this.getApplied();
    const appliedVersions = new Set(applied.map((m) => m.version));

    const pending = migrations.filter((m) => !appliedVersions.has(m.version));
    if (pending.length === 0) {
      this.logger.log('No pending migrations.');
      return;
    }

    await this.dataSource.transaction(async (em) => {
      for (const migration of pending) {
        this.logger.log(`Applying migration v${migration.version}: ${migration.name}`);
        await em.query(migration.sql);
        await em.query(
          `INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, NOW())`,
          [migration.version, migration.name],
        );
      }
    });
  }

  /** Rolls back the last applied migration. */
  async rollbackLast(rollbackSql: string): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      await em.query(rollbackSql);
      await em.query(`DELETE FROM schema_migrations WHERE version = (SELECT MAX(version) FROM schema_migrations)`);
    });
    this.logger.log('Rolled back last migration.');
  }
}